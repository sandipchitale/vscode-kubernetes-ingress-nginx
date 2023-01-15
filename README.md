# vscode-kubernetes-ingress-nginx README

## Features

It supports the following commands:

| Command | Treenode Type| Description |
|---------|----------|-------------|
|`k8s.ingress-nginx.conf` NGINX config for ingress hosts| Ingress | Show configuration for hosts of selected ingress. |
|`k8s.ingress-nginx.certs` Certificates for ingress hosts | Ingress | Show certificates for hosts of selected ingress.|
|`k8s.ingress-nginx.backends` All Ingress Backends | Ingress | Show all managed backends.|

## Requirements

This extension works with Microsoft Kubernetes extension.

**IMPORTANT:** Make sure to installe the `ingress-nginx` plgin for kubernetes and have it in your PATH.

## Known Issues

- None

## Release Notes

### 1.0.9

Initial release.
