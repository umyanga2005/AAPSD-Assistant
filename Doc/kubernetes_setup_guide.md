# Kubernetes Setup Guide for Beginners

If you don't have a Kubernetes "account" or cluster yet, don't worry! Kubernetes isn't a traditional website where you create an account; it is software that you run to manage applications.

To test your DevOps Assistant, the easiest way is to install a **local Kubernetes cluster** directly on your Windows machine.

---

## 1. Choose Your Local Kubernetes Tool

You have two easy options to run Kubernetes locally on Windows. **Docker Desktop** is highly recommended if you already have it installed.

### Option A: Docker Desktop (Recommended)

If you already use Docker Desktop for Windows:

1. Open the **Docker Desktop** application.
2. Click the **Gear icon** (Settings) in the top right corner.
3. In the left menu, select **Kubernetes**.
4. Check the box that says **Enable Kubernetes**.
5. Click **Apply & Restart** at the bottom right.
6. Wait a few minutes. You will see a green Kubernetes logo at the bottom left indicating it is running.

### Option B: Minikube

If you don't use Docker Desktop, you can install Minikube:

1. Open PowerShell as Administrator.
2. Install Minikube using Winget (Windows Package Manager):
   ```powershell
   winget install minikube
   ```
3. Restart PowerShell, then start your cluster:
   ```powershell
   minikube start
   ```

---

## 2. Install `kubectl` (The Kubernetes Command Line)

`kubectl` is the tool you use to talk to your new Kubernetes cluster from your terminal.

_(Note: If you used Docker Desktop to install Kubernetes, `kubectl` is already installed for you! You can skip to Step 3)._

If you need to install it manually on Windows:

1. Open PowerShell.
2. Run this command:
   ```powershell
   curl.exe -LO "https://dl.k8s.io/release/v1.30.0/bin/windows/amd64/kubectl.exe"
   ```
3. Move `kubectl.exe` to a folder that is in your Windows system PATH, or just run it directly from where you downloaded it.

---

## 3. Verify Your Cluster is Running

Open your PowerShell terminal and type:

```bash
kubectl get nodes
```

_Expected Output:_ You should see a node (usually named `docker-desktop` or `minikube`) with the status `Ready`.

---

## 4. Generate the AAPSD-Assistant Credentials

Now that you have your own Kubernetes cluster running, you can create the credentials the DevOps assistant needs. Run the following commands one by one in your PowerShell terminal:

**1. Create a Service Account for the Assistant:**

```bash
kubectl create serviceaccount aapsd-assistant-sa
```

**2. Give the Assistant Read-Only Access:**

```bash
kubectl create clusterrolebinding aapsd-assistant-view-binding --clusterrole=view --serviceaccount=default:aapsd-assistant-sa
```

**3. Generate the `K8S_TOKEN`:**

```bash
kubectl create token aapsd-assistant-sa --duration=8760h
```

_(Copy the long block of text this command prints out. It starts with `eyJ`. This is your `K8S_TOKEN`.)_

**4. Find your `K8S_API_SERVER_URL`:**

```bash
kubectl cluster-info
```

_(Copy the URL next to "Kubernetes control plane is running at". For local Docker Desktop, it is usually `https://127.0.0.1:6443`)_

---

## 5. Add to `.env`

Finally, open your `apps/api/.env` file and paste in what you copied:

```env
K8S_TOKEN=eyJhbGciOiJSUzI... (paste full token here)
K8S_API_SERVER_URL=https://127.0.0.1:6443
K8S_ALLOWED_NAMESPACES=default
```

You have now successfully set up a Kubernetes cluster from scratch and connected it to your AI Assistant!
