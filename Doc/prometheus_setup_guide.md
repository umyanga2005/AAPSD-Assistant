# Prometheus Setup Guide for Local Kubernetes

Since you are running a local Kubernetes cluster (like Docker Desktop), you can install Prometheus directly into it to monitor your pods and containers. This guide will walk you through installing Prometheus using **Helm** (the package manager for Kubernetes) and connecting it to your assistant.

---

## 1. Install Helm (Kubernetes Package Manager)

Helm makes it incredibly easy to install complex software like Prometheus into your cluster.

1. Open PowerShell as Administrator.
2. Run the following command to install Helm using Winget:
   ```powershell
   winget install Helm.Helm
   ```
3. Once installed, **restart your PowerShell window** so the `helm` command is recognized.
4. Verify the installation by running:
   ```powershell
   helm version
   ```

---

## 2. Install Prometheus into your Cluster

Now that you have Helm, you can install the Prometheus stack.

1. **Add the Prometheus repository** to Helm:
   ```powershell
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   ```
2. **Update your Helm repositories:**
   ```powershell
   helm repo update
   ```
3. **Install Prometheus:**
   Run this command to install the Prometheus server into a new namespace called `monitoring`:
   ```powershell
   helm install prometheus prometheus-community/prometheus --namespace monitoring --create-namespace
   ```
4. **Wait for it to start:**
   Check if the Prometheus pods are running:
   ```powershell
   kubectl get pods -n monitoring
   ```
   _(Wait until you see the `prometheus-server` pod showing a status of `Running`)_

---

## 3. Expose the Prometheus Server

By default, Prometheus is running safely inside your Kubernetes cluster, but your DevOps Assistant (running on your Windows host) needs to be able to reach it.

We will use **Port Forwarding** to expose it to your local machine.

1. **Run the port-forward command:**

   ```powershell
   kubectl --namespace monitoring port-forward svc/prometheus-server 9090:80
   ```

   _Note: This command will "hang" and stay open in your terminal. This is completely normal! It means the tunnel is open. You must leave this terminal window open while testing the assistant._

2. **Verify it works:**
   Open your web browser and go to: `http://localhost:9090`
   You should see the Prometheus web interface!

---

## 4. Update your `.env` File

Now that Prometheus is running on `http://localhost:9090`, you can update your backend configuration.

Open your `apps/api/.env` file and replace the empty Prometheus section at the bottom with this:

```env
# Prometheus integration
PROMETHEUS_BASE_URL=http://localhost:9090
PROMETHEUS_ALLOWED_METRICS=node_cpu_seconds_total,container_memory_usage_bytes,kube_pod_container_status_restarts_total
```

### You're all set!

Your Agentic AI Assistant can now pull live metrics from your Kubernetes cluster to detect CPU spikes, memory leaks, and crashing pods!
