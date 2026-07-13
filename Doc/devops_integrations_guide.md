# DevOps Integrations Setup Guide

To fully power the AAPSD-Assistant, you need to connect it to your live DevOps environments. This guide explains step-by-step how to get the tokens and URLs for **GitHub**, **Kubernetes**, and **Prometheus**.

---

## 1. GitHub Integration

The assistant needs a GitHub token to read your CI/CD pipeline statuses, fetch workflow run logs, and analyze errors.

### How to get the `GITHUB_TOKEN`:

1. Log in to [GitHub](https://github.com/).
2. In the upper-right corner of any page, click your profile photo, then click **Settings**.
3. In the left sidebar, scroll down and click **Developer settings**.
4. In the left sidebar, under **Personal access tokens**, click **Tokens (classic)**.
5. Click **Generate new token** -> **Generate new token (classic)**.
6. Give your token a descriptive name (e.g., `AAPSD-Assistant-Token`).
7. **Select Scopes (Permissions)**:
   - Check `repo` (Full control of private repositories) — _Required so the assistant can read workflow runs and code._
   - Check `workflow` (Update GitHub Action workflows) — _Required if you want the assistant to trigger pipelines later._
8. Click **Generate token** at the bottom of the page.
9. **Copy the token immediately** (it starts with `ghp_`). You will not be able to see it again.

### Configuring the `.env`:

```env
GITHUB_TOKEN=ghp_your_copied_token_here
# Replace with your actual GitHub username and repository name
GITHUB_ALLOWED_REPOS=your-username/your-repo-name
```

---

## 2. Kubernetes Integration

The assistant needs access to your Kubernetes cluster to read pod statuses, fetch crash logs, and view deployments.

### How to get the `K8S_TOKEN` and `K8S_API_SERVER_URL`:

You need to create a `ServiceAccount` with read-only permissions in your Kubernetes cluster and extract its token.

1. **Open your terminal** (connected to your Kubernetes cluster via `kubectl`).
2. **Create a Service Account:**
   ```bash
   kubectl create serviceaccount aapsd-assistant-sa
   ```
3. **Bind the Read-Only ClusterRole:**
   Bind the default `view` ClusterRole to your new service account so it can only read data:
   ```bash
   kubectl create clusterrolebinding aapsd-assistant-view-binding \
     --clusterrole=view \
     --serviceaccount=default:aapsd-assistant-sa
   ```
4. **Generate the Token:**
   Generate a long-lived token for this service account:
   ```bash
   kubectl create token aapsd-assistant-sa --duration=8760h
   ```
   _Copy the long JWT string that is outputted._ This is your `K8S_TOKEN`.
5. **Get the API Server URL:**
   Run the following command to find your cluster's API endpoint:
   ```bash
   kubectl cluster-info
   ```
   _Look for the URL next to "Kubernetes control plane is running at"._ This is your `K8S_API_SERVER_URL`.

### Configuring the `.env`:

```env
K8S_TOKEN=eyJhbGciOiJSUzI1NiIsImtpZCI... (your copied token)
K8S_API_SERVER_URL=https://127.0.0.1:6443 # (or your cloud cluster URL)
K8S_ALLOWED_NAMESPACES=default,production # (namespaces you want to allow)
```

---

## 3. Prometheus Integration

The assistant uses Prometheus to query metrics like CPU spikes, memory limits, and container restarts to diagnose performance bottlenecks.

### How to get the `PROMETHEUS_BASE_URL`:

1. Identify where Prometheus is hosted in your infrastructure.
   - **Local Kubernetes:** If you are port-forwarding it locally, it might be `http://localhost:9090`.
   - **Cloud Hosted:** If you use an external monitoring tool (like Grafana Cloud or AWS Managed Prometheus), you need the specific query endpoint URL provided by your hosting service.
2. If Prometheus is inside your Kubernetes cluster and AAPSD-Assistant is running outside it, you will need to Expose the Prometheus server (via NodePort, LoadBalancer, or Ingress) so the assistant can reach it.

### Configuring the `.env`:

```env
PROMETHEUS_BASE_URL=http://your-prometheus-server-url:9090
PROMETHEUS_ALLOWED_METRICS=node_cpu_seconds_total,container_memory_usage_bytes,kube_pod_container_status_restarts_total
```
