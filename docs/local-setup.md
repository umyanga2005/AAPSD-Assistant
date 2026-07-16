# Local Setup and Reproducible Staging Environment

This document outlines how to run a complete local instance of the AAPSD-Assistant platform using Docker Compose. This environment includes the web frontend, API backend, PostgreSQL database, and Redis.

## Prerequisites

- Docker and Docker Compose installed.
- (Optional) Minikube installed for local Kubernetes integration testing.

### Installing Minikube (Windows)

If you want to test Kubernetes integrations (Assistant and Governed Actions) locally without Docker Desktop's built-in Kubernetes:

1. Open PowerShell as Administrator and run: `winget install minikube`
2. Restart your terminal.
3. Start Minikube: `minikube start`
4. Run the helper script to generate the required `.env` credentials:
   ```powershell
   .\scripts\setup-minikube.ps1
   ```
5. Copy the generated `K8S_API_SERVER_URL` and `K8S_TOKEN` into your `apps/api/.env` file.

## 1. Setup

### Configuration

1. Navigate to the `infra/docker` directory:
   ```bash
   cd infra/docker
   ```
2. For a local development environment, copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. For a safe, reproducible staging demonstration with mutable actions disabled, copy the staging environment file:
   ```bash
   cp staging.env .env
   ```
4. Edit the `.env` file and replace the placeholder `dummy_*` values with valid credentials if you are testing external integrations (e.g., GitHub, Kubernetes).

### Running the Stack

Start the services in detached mode:

```bash
docker-compose up -d
```

The startup process will automatically:

1. Initialize the PostgreSQL and Redis containers.
2. Wait for the database and cache to be healthy.
3. Run `npm run db:migrate` in the API container.
4. Start the API backend on `http://localhost:3000`.
5. Start the Web frontend on `http://localhost:5173`.

## 2. Teardown

To stop the services and optionally remove the database data:

```bash
# Stop containers but preserve database data
docker-compose down

# Stop containers and remove volumes (wipes the database)
docker-compose down -v
```

## 3. Database Backup and Restore

### Backup

To create a backup of the local PostgreSQL database, run the following command while the stack is running:

```bash
docker exec -t docker-db-1 pg_dump -U aapsd_user aapsd_db > aapsd_backup.sql
```

_(Note: Replace `docker-db-1` with your actual container name if it differs, usually `<project_folder>_db_1`)_

### Restore

To restore a backup into the local database (this will overwrite existing data):

```bash
cat aapsd_backup.sql | docker exec -i docker-db-1 psql -U aapsd_user -d aapsd_db
```

## Security Note

Never commit real API keys or tokens to source control. The provided `.env.example` and `staging.env` contain placeholders only. The `staging.env` file specifically disables all deployment scaling and execution limits to provide a safe, read-only demonstration out-of-the-box.
