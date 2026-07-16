# Low-Memory Local Lite Deployment Profile

This profile is designed specifically for running the AAPSD-Assistant on constrained hardware, such as an 8 GB Windows laptop, without the overhead of Docker Desktop, Kubernetes, or Redis.

## Overview

- **Web App**: Runs directly using Vite via Node.js.
- **Node API**: Runs directly via Node.js.
- **Job Queue**: Uses an in-memory asynchronous queue instead of Redis and BullMQ.
- **Infrastructure Adapters**: Automatically uses deterministic mock adapters for Kubernetes, Docker, Prometheus, and Terraform. No real cloud dependencies are initialized.
- **Security Guardrails**: All mutable execution actions (e.g., deployments, restarts) are strictly disabled at the API level.

## Prerequisites

- Node.js v22 or higher
- PostgreSQL running locally (can be a lightweight native binary or a small existing container)

## Setup Instructions

1. **Copy the Configuration**
   Copy the provided template to set up the lightweight environment:

   ```bash
   cp .env.local-lite.example .env
   ```

2. **Database Initialization**
   Ensure your local PostgreSQL instance is running, then run migrations:

   ```bash
   cd apps/api
   npm run db:migrate
   ```

3. **Start the API Server**
   In your first terminal, start the backend API:

   ```bash
   cd apps/api
   npm start
   ```

4. **Start the Web Frontend**
   In a second terminal, start the Vite React application:
   ```bash
   cd apps/web
   npm run dev
   ```

The application will now be available at `http://localhost:5173`. You will see a "Local Lite Simulation" badge in the header indicating you are running safely in mocked-infrastructure mode.

## Transitioning to Remote Staging

Once you are ready to test against real infrastructure without straining your local laptop, you can switch to `staging-remote`.

1. Update your `.env` file to set `DEPLOYMENT_PROFILE=staging-remote`.
2. Provide valid `REDIS_URL`, `GITHUB_TOKEN`, and `K8S_TOKEN`.
3. Restart the API.
   The system will now securely communicate with the remote staging cluster while still running the dashboard locally.

## Full Container Environment

If you acquire a machine with sufficient resources and wish to run the entire stack locally in containers, refer to the official compose configuration at `infra/docker/docker-compose.yml`.
