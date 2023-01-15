'use strict';

import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

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

    context.subscriptions.push(vscode.commands.registerCommand('k8s.ingress-nginx.backends', backends));
    context.subscriptions.push(vscode.commands.registerCommand('k8s.ingress-nginx.conf', hostConf));
    context.subscriptions.push(vscode.commands.registerCommand('k8s.ingress-nginx.certs', hostCerts));
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
                const backendDetails = await kubectl.api.invokeCommand(`ingress-nginx backends -n ${ingressNginxDeploymentNamespace} --deployment ${ingressNginxDeploymentName}`);
                if (backendDetails && backendDetails.stdout) {
                    const doc = await vscode.workspace.openTextDocument({
                        content: `Ingress Backends:\n\n${backendDetails.stdout}`
                    });
                    await vscode.window.showTextDocument(doc, { preview: false });
                }
            }
        }
    }
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
                            if (confDetails && confDetails.stdout) {
                                const doc = await vscode.workspace.openTextDocument({
                                    content: `Configuration for ingress: ${commandTarget.name} host: ${rule.host}\n\n${confDetails.stdout}`
                                });
                                await vscode.window.showTextDocument(doc, { preview: false });
                            }
                        }
                    });
                }
            }
        }
    }
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
                            const certsDetails = await kubectl.api.invokeCommand(`ingress-nginx certs -n ${ingressNginxDeploymentNamespace} --deployment ${ingressNginxDeploymentName} --host ${rule.host}`);
                            if (certsDetails && certsDetails.stdout) {
                                const doc = await vscode.workspace.openTextDocument({
                                    content: `Certificates for ingress: ${commandTarget.name} host: ${rule.host}\n\n${certsDetails.stdout}`
                                });
                                await vscode.window.showTextDocument(doc, { preview: false });
                            }
                        }
                    });
                }
            }
        }
    }
}

export function deactivate() {
}
