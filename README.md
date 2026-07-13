# AAPSD-Assistant

AI-assisted platform for pipeline diagnostics and staging operations.

## Prerequisites

- Node.js >= 20
- npm >= 10

## Setup

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run linting
npm run lint

# Check formatting
npm run format

# TypeScript type check
npm run typecheck
```

## API

```bash
# Start the API (production build)
cd apps/api && npm run build && npm run start

# Development mode with hot reload
cd apps/api && npm run dev

# Test the endpoints
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

The `PORT` environment variable configures the listen port (default: `3000`).

## Frontend

```bash
# Start the development server (localhost:5173)
cd apps/web && npm run dev

# Production build
cd apps/web && npm run build
```

Configure the backend URL in `apps/web/.env`:

```
VITE_API_URL=http://localhost:3000
```

## Tests

```bash
# Run all tests
npm run test --workspace=@aapsd/api
npm run test --workspace=@aapsd/web
npm run test --workspace=@aapsd/diagnosis
```

## Docker (PostgreSQL + Redis)

```bash
# Start services
docker compose -f infra/docker/compose.yaml --env-file infra/docker/.env up -d

# View logs
docker compose -f infra/docker/compose.yaml logs -f

# Stop services
docker compose -f infra/docker/compose.yaml down

# Stop and delete volumes (resets all data)
docker compose -f infra/docker/compose.yaml down -v
```

Default credentials are in `infra/docker/.env.example`. Copy it to `infra/docker/.env` to customise:

```bash
cp infra/docker/.env.example infra/docker/.env
```

The `.env` file is gitignored — never commit secrets.

## Pre-commit Hooks

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged). After `npm install`, hooks are automatically configured via the `prepare` script.

## Project Structure

```
apps/
  web/                  React + TypeScript frontend
  api/                  Node.js + TypeScript backend
  ai-service/           Python FastAPI agent service (future)
packages/
  contracts/            Shared API schemas
  policy/               Action and approval rules
infra/
  docker/               Local Docker Compose setup
  kubernetes/           Deployment manifests (future)
docs/
  runbooks/             Approved knowledge-base documents
```
