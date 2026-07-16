# Script to set up Minikube authentication for AAPSD-Assistant

Write-Host "Setting up Minikube for AAPSD-Assistant..." -ForegroundColor Cyan

# 1. Check if minikube is installed
if (-not (Get-Command "minikube" -ErrorAction SilentlyContinue)) {
    Write-Host "Minikube is not installed." -ForegroundColor Red
    Write-Host "To install Minikube on Windows, you can use winget:"
    Write-Host "winget install minikube"
    Write-Host "After installation, restart your terminal and run this script again."
    exit 1
}

# 2. Check if kubectl is installed
if (-not (Get-Command "kubectl" -ErrorAction SilentlyContinue)) {
    Write-Host "kubectl is not installed. Minikube will use its own." -ForegroundColor Yellow
    Set-Alias -Name kubectl -Value "minikube kubectl --"
}

# 3. Check if minikube is running
$status = minikube status --format="{{.Host}}"
if ($status -ne "Running") {
    Write-Host "Minikube is not running. Starting Minikube..." -ForegroundColor Yellow
    minikube start
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start Minikube. Please check the logs." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Configuring Kubernetes ServiceAccount for API access..." -ForegroundColor Cyan

# 4. Create ServiceAccount
kubectl create serviceaccount aapsd-assistant --namespace default --dry-run=client -o yaml | kubectl apply -f -

# 5. Create ClusterRoleBinding to allow the API to inspect and manage the cluster
kubectl create clusterrolebinding aapsd-assistant-admin `
  --clusterrole=cluster-admin `
  --serviceaccount=default:aapsd-assistant `
  --dry-run=client -o yaml | kubectl apply -f -

# 6. Create a long-lived secret/token for the ServiceAccount
$secretYaml = @"
apiVersion: v1
kind: Secret
metadata:
  name: aapsd-assistant-token
  namespace: default
  annotations:
    kubernetes.io/service-account.name: aapsd-assistant
type: kubernetes.io/service-account-token
"@
$secretYaml | kubectl apply -f -

# Wait for the token to be populated
Start-Sleep -Seconds 2

# 7. Extract the token and API Server URL
$token = kubectl get secret aapsd-assistant-token --namespace default -o jsonpath="{.data.token}"
if ($token) {
    # Base64 decode the token in PowerShell
    $decodedToken = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($token))
} else {
    Write-Host "Failed to generate token. Are you using an older version of Kubernetes?" -ForegroundColor Red
    exit 1
}

$apiUrl = kubectl config view --minify -o jsonpath="{.clusters[0].cluster.server}"

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "Minikube Setup Complete!" -ForegroundColor Green
Write-Host "Copy the following values into your apps/api/.env file:" -ForegroundColor Green
Write-Host "========================================================`n"

Write-Host "K8S_API_SERVER_URL=$apiUrl" -ForegroundColor Yellow
Write-Host "K8S_TOKEN=$decodedToken" -ForegroundColor Yellow
Write-Host "`n========================================================" -ForegroundColor Green
