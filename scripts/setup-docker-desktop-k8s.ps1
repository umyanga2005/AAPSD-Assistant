# Script to set up Docker Desktop Kubernetes for AAPSD-Assistant
# Run this from the project root directory

Write-Host "Setting up Docker Desktop Kubernetes for AAPSD-Assistant..." -ForegroundColor Cyan

# 1. Check if kubectl is available
if (-not (Get-Command "kubectl" -ErrorAction SilentlyContinue)) {
    Write-Host "kubectl is not found. Make sure Docker Desktop with Kubernetes is running." -ForegroundColor Red
    exit 1
}

# 2. Check if Docker Desktop Kubernetes context is active
$currentContext = kubectl config current-context 2>$null
if ($null -eq $currentContext) {
    Write-Host "No Kubernetes context found. Enable Kubernetes in Docker Desktop Settings." -ForegroundColor Red
    exit 1
}

Write-Host "Active Kubernetes context: $currentContext" -ForegroundColor Green

# 3. Create the ServiceAccount for AAPSD-Assistant
Write-Host "Creating ServiceAccount 'aapsd-assistant' in default namespace..." -ForegroundColor Cyan
kubectl create serviceaccount aapsd-assistant --namespace default --dry-run=client -o yaml | kubectl apply -f -

# 4. Create ClusterRoleBinding (cluster-admin for testing)
Write-Host "Granting cluster-admin role to ServiceAccount..." -ForegroundColor Cyan
kubectl create clusterrolebinding aapsd-assistant-admin `
  --clusterrole=cluster-admin `
  --serviceaccount=default:aapsd-assistant `
  --dry-run=client -o yaml | kubectl apply -f -

# 5. Create long-lived token secret
Write-Host "Creating long-lived token secret..." -ForegroundColor Cyan
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

# Wait for the token to be populated by Kubernetes
Write-Host "Waiting for token to be generated..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 6. Extract the token
$tokenBase64 = kubectl get secret aapsd-assistant-token --namespace default -o jsonpath="{.data.token}" 2>$null
if (-not $tokenBase64) {
    Write-Host "Failed to get token. Retrying in 5 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    $tokenBase64 = kubectl get secret aapsd-assistant-token --namespace default -o jsonpath="{.data.token}"
}

if (-not $tokenBase64) {
    Write-Host "Could not generate token. Check if Kubernetes is healthy in Docker Desktop." -ForegroundColor Red
    exit 1
}

$decodedToken = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($tokenBase64))

# 7. Get the API Server URL from kubectl config
$apiUrl = kubectl config view --minify -o jsonpath="{.clusters[0].cluster.server}"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "Docker Desktop Kubernetes Setup Complete!" -ForegroundColor Green
Write-Host "Copy the following values into your apps/api/.env file:" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "K8S_SKIP_TLS_VERIFY=true" -ForegroundColor Yellow
Write-Host "K8S_API_SERVER_URL=$apiUrl" -ForegroundColor Yellow
Write-Host "K8S_TOKEN=$decodedToken" -ForegroundColor Yellow
Write-Host "K8S_ALLOWED_NAMESPACES=default,kube-system" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Also run this to start Redis:" -ForegroundColor Cyan
Write-Host "docker run -d --name aapsd-redis -p 6379:6379 redis:alpine" -ForegroundColor Yellow
Write-Host "(If it already exists: docker start aapsd-redis)" -ForegroundColor DarkGray
Write-Host "========================================================" -ForegroundColor Green
