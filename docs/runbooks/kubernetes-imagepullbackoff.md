---
id: kubernetes-imagepullbackoff
title: Kubernetes ImagePullBackOff
tags: [kubernetes, k8s, imagepullbackoff, container, image, pod, registry, deployment]
---

## Overview

The `ImagePullBackOff` status indicates that Kubernetes is unable to pull the container image specified in a pod specification. This runbook helps diagnose and resolve the underlying cause.

## Common Causes

1. **Image tag does not exist**: The image tag referenced in the pod spec does not exist in the registry. Verify the tag exists by pulling it manually with `docker pull`.

2. **Registry credentials are missing or expired**: The image pull secret (`imagePullSecrets`) may be missing, incorrect, or expired. Check secret existence and validity.

3. **Network connectivity issues**: The cluster node may not have network access to the container registry. Test connectivity from the node using `curl` or `nslookup`.

4. **Rate limiting**: The container registry may throttle requests from the cluster IP. This is common with Docker Hub's anonymous pull limits.

5. **Image name or registry URL is incorrect**: A typo in the image name or registry URL will cause the pull to fail. Double-check the image spec in the deployment manifest.

## Diagnostic Steps

1. Run `kubectl describe pod <pod-name>` and look for events at the bottom.
2. Check the `Events` section for the exact error message (e.g., "not found", "unauthorized", "timeout").
3. Run `kubectl get secrets` to confirm the image pull secret exists.
4. If using a private registry, verify the secret contains valid base64-encoded credentials.
5. Test image pull from a node directly using `crictl pull` or `docker pull`.

## Resolution

- If the tag is missing, rebuild and push the image with the correct tag, then restart the deployment.
- If credentials are expired, regenerate them and update the secret: `kubectl create secret docker-registry ... --dry-run=client -o yaml | kubectl apply -f -`
- If the registry is unreachable, check firewall rules, VPC peering, and DNS resolution.
- If rate-limited, switch to an authenticated pull or use a different registry.

## Related

- GitHub Actions Deployment Failure runbook
- High CPU / memory troubleshooting runbook
