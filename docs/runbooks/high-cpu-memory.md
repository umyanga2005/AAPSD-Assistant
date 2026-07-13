---
id: high-cpu-memory
title: High CPU and Memory Usage Troubleshooting
tags: [kubernetes, k8s, cpu, memory, resource, performance, oom, scaling, pod, node]
---

## Overview

High CPU or memory usage can cause application performance degradation, pod evictions, and node pressure. This runbook covers diagnosis and mitigation for resource exhaustion scenarios.

## Common Causes

1. **Memory leak**: Application code fails to release memory over time, causing gradual growth until the pod is OOMKilled. Check heap dumps and garbage collection logs.

2. **Traffic spike**: A sudden increase in requests overwhelms the current replica count. Check request rates, response times, and autoscaler configuration.

3. **Inefficient queries**: Slow database queries or N+1 API calls consume excessive CPU. Review query performance and add appropriate indexes.

4. **Resource limits misconfiguration**: The pod's CPU/memory requests or limits may be set too low for the actual workload. Compare resource usage against current limits using `kubectl top pod`.

5. **Node resource pressure**: Other pods on the same node may be competing for resources. Check node status and resource allocation with `kubectl describe node`.

## Diagnostic Steps

1. Run `kubectl top pod -n <namespace> --sort-by=cpu` or `--sort-by=memory` to identify top consumers.
2. Check pod events: `kubectl describe pod <pod-name>` and look for `OOMKilled` or `Evicted` status.
3. Inspect container logs for error patterns or slowdown indicators.
4. Check the HorizontalPodAutoscaler status: `kubectl get hpa`.
5. Review recent deployment or config changes that may have introduced the issue.
6. For sustained issues, enable metrics-server and review Prometheus or Grafana dashboards.

## Resolution

- If memory leak is suspected, capture a heap dump and analyze it with tools like `pprof` or Eclipse MAT.
- If traffic is spiking, increase the replica count or tune the HPA thresholds.
- If queries are slow, add database indexes or implement caching.
- Adjust resource requests and limits: increase limits if the pod consistently needs more; decrease requests to improve scheduling density.
- If the node is under pressure, cordon the node and drain pods, or scale up the node pool.

## Related

- Kubernetes ImagePullBackOff runbook
- GitHub Actions Deployment Failure runbook
