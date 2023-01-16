'use strict';

import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { X509Certificate } from 'crypto';

let ingressNginxDeploymentNamespace = 'ingress-nginx-ns';
let ingressNginxDeploymentName = 'ingress-nginx-controller';

export async function activate(context: vscode.ExtensionContext) {
    const explorer = await k8s.extension.clusterExplorer.v1;
    if (!explorer.available) {
        vscode.window.showErrorMessage(`ClusterExplorer not available.`);
        return;
    }

    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        vscode.window.showErrorMessage(`kubectl not available.`);
        return;
    }

    ingressNginxDeploymentNamespace = vscode.workspace.getConfiguration().get<string>('vscode-kubernetes-ingress-nginx.ingress-nginx-deployment-namespace', ingressNginxDeploymentNamespace);
    ingressNginxDeploymentName = vscode.workspace.getConfiguration().get<string>('vscode-kubernetes-ingress-nginx.ingress-nginx-deployment-name', ingressNginxDeploymentName);

    context.subscriptions.push(vscode.commands.registerCommand('k8s.ingress-nginx.backends', backendsWithProgress));
    context.subscriptions.push(vscode.commands.registerCommand('k8s.ingress-nginx.conf', hostConfWithProgress));
    context.subscriptions.push(vscode.commands.registerCommand('k8s.ingress-nginx.certs', hostCertsWithProgress));
}

async function backendsWithProgress(target?: any) {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Getting all backends for ingress`
    }, (progress, token) => {
        return new Promise(async (resolve, reject) => {
            try {
                await backends(target);
                resolve('');
            } catch (error) {
                reject(error)
            }
        });
    });
}

async function backends(target?: any) {
    const explorer = await k8s.extension.clusterExplorer.v1;
    if (!explorer.available) {
        return;
    }

    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        return;
    }

    const commandTarget = explorer.api.resolveCommandTarget(target);
    if (commandTarget) {
        if (commandTarget.nodeType === 'resource') {
            if (commandTarget.resourceKind.manifestKind === 'Ingress') {
                try {
                    invokeCommandAndShowOutput(
                        `ingress-nginx backends -n ${ingressNginxDeploymentNamespace} --deployment ${ingressNginxDeploymentName}`,
                        `// Ingress Backends`,
                        false,
                        'jsonc'
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to get ingress backends.`);
                }
            }
        }
    }
}

async function hostConfWithProgress(target?: any) {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Getting NGINX configurations for ingress hosts`
    }, (progress, token) => {
        return new Promise(async (resolve, reject) => {
            try {
                await hostConf(target);
                resolve('');
            } catch (error) {
                reject(error)
            }
        });
    });
}

async function hostConf(target?: any) {
    const explorer = await k8s.extension.clusterExplorer.v1;
    if (!explorer.available) {
        return;
    }

    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        return;
    }

    const commandTarget = explorer.api.resolveCommandTarget(target);
    if (commandTarget) {
        if (commandTarget.nodeType === 'resource') {
            if (commandTarget.resourceKind.manifestKind === 'Ingress') {
                const ingressDetails = await kubectl.api.invokeCommand(`get ingress ${commandTarget.name} -o json`);
                if (ingressDetails && ingressDetails.stdout) {
                    const ingressDetailsAsJson = JSON.parse(ingressDetails.stdout);
                    ingressDetailsAsJson.spec.rules.forEach(async (rule: any) => {
                        if (rule.host) {
                            const confDetails = await kubectl.api.invokeCommand(`ingress-nginx conf -n ${ingressNginxDeploymentNamespace} --deployment ${ingressNginxDeploymentName} --host ${rule.host}`);
                            try {
                                invokeCommandAndShowOutput(
                                    `ingress-nginx conf -n ${ingressNginxDeploymentNamespace} --deployment ${ingressNginxDeploymentName} --host ${rule.host}`,
                                    `# Configuration for ingress: ${commandTarget.name} host: ${rule.host} :`,
                                    false,
                                    (await vscode.languages.getLanguages()).includes('nginx') ? 'nginx' : 'plaintext'
                                );
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to get configuration for ingress: ${commandTarget.name} host: ${rule.host}`);
                            }
                        }
                    });
                }
            }
        }
    }
}

async function hostCertsWithProgress(target?: any) {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Getting certificate chains for ingress hosts`
    }, (progress, token) => {
        return new Promise(async (resolve, reject) => {
            try {
                await hostCerts(target);
                resolve('');
            } catch (error) {
                reject(error)
            }
        });
    });
}

async function hostCerts(target?: any) {
    const explorer = await k8s.extension.clusterExplorer.v1;
    if (!explorer.available) {
        return;
    }

    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        return;
    }

    const commandTarget = explorer.api.resolveCommandTarget(target);
    if (commandTarget) {
        if (commandTarget.nodeType === 'resource') {
            if (commandTarget.resourceKind.manifestKind === 'Ingress') {
                const ingressDetails = await kubectl.api.invokeCommand(`get ingress ${commandTarget.name} -o json`);
                if (ingressDetails && ingressDetails.stdout) {
                    const ingressDetailsAsJson = JSON.parse(ingressDetails.stdout);
                    ingressDetailsAsJson.spec.rules.forEach(async (rule: any) => {
                        if (rule.host) {
                            try {
                                const certificatesAndKeys = await invokeCommandAndShowOutput(
                                    `ingress-nginx certs -n ${ ingressNginxDeploymentNamespace } --deployment ${ ingressNginxDeploymentName } --host ${ rule.host }`,
                                    `Certificates for ingress: ${commandTarget.name} host: ${rule.host} :`,
                                    true
                                );
                            } catch (error) {
                                vscode.window.showErrorMessage(`Failed to get certificates for ingress: ${commandTarget.name} host: ${rule.host}: Error: ${error}`);
                            }
                        }
                    });
                }
            }
        }
    }
}

async function invokeCommandAndShowOutput(command: string, prefix: string, processCerts = false, language = 'plaintext'): Promise<string> {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        return;
    }

    const commandDetails = await kubectl.api.invokeCommand(command);
    if (commandDetails && commandDetails.code === 0 && commandDetails.stdout) {
        let content = commandDetails.stdout;
        if (processCerts) {
            content = '';
            commandDetails.stdout.split('-----END CERTIFICATE-----').forEach((certificateOrKey: string) => {
                if (certificateOrKey) {
                    if (certificateOrKey.startsWith('-----BEGIN CERTIFICATE-----') ||
                        certificateOrKey.startsWith('\n-----BEGIN CERTIFICATE-----') ) {
                        let certificateAsPem = `${certificateOrKey}`.trim();
                        if (certificateAsPem.endsWith('\n')) {
                            certificateAsPem += '-----END CERTIFICATE-----';
                        } else {
                            certificateAsPem += '\n-----END CERTIFICATE-----';
                        }
                        try {
                            const cert = new X509Certificate(certificateAsPem);
                            let certString = `X509Certificate {
    Subject: ${cert.subject}
    Subject Alt Name: ${cert.subjectAltName?.split(',').join('\n\t\t')}
    Issuer: ${cert.issuer},
    Infoaccess: ${cert.infoAccess}
    Validfrom: ${cert.validFrom}
    Validto: ${cert.validTo}
    Fingerprint: ${cert.fingerprint}
    Fingerprint256: ${cert.fingerprint256}
    Keyusage: ${cert.keyUsage}
    Serialnumbe: ${cert.serialNumber}
}`.trim();
                            content = `${content}\n${certificateAsPem}\n\nDecoded X509Certificate:\n${certString}\n\n`;
                        } catch (error) {
                            console.error(error);
                            content = `${content}\n${certificateOrKey}`;
                        }
                    } else {
                        content = `${content}\n${certificateOrKey}`;
                    }
                }
            });
        }
        const doc = await vscode.workspace.openTextDocument({
            language: language,
            content: `${prefix}\n\n${content}`
        });
        await vscode.window.showTextDocument(doc, { preview: false });
        return Promise.resolve(commandDetails.stdout);
    } else {
        return Promise.reject(commandDetails.stderr);
    }
}

export function deactivate() {
}
