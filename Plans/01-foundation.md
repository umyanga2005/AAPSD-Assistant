# Phase 1 - Application Foundation

## Goal

Create a secure, testable application base before connecting AI or DevOps tools.

## Recommended structure

```text
apps/
  web/                 React + TypeScript frontend
  api/                 Node.js + TypeScript backend
  ai-service/          Python FastAPI agent service
packages/
  contracts/           Shared API schemas
  policy/              Action and approval rules
infra/
  docker/              Local Docker Compose setup
  kubernetes/          Later deployment manifests
docs/
  runbooks/            Approved knowledge-base documents
```

## Work items

- Initialize Git repository, monorepo, code formatting, linting, and pre-commit checks.
- Create React dashboard shell and authenticated API service.
- Implement OAuth/OIDC login and role-based access control.
- Create PostgreSQL schema for users, projects, environments, requests, plans, approvals, executions, and audit events.
- Add Redis-backed asynchronous job queue.
- Add structured logs, health endpoints, OpenTelemetry trace IDs, and error handling.
- Build Docker Compose for local development: web, API, AI service, PostgreSQL, Redis.

## Example policy contract

```json
{
  "action": "github.workflow.dispatch",
  "environment": "staging",
  "rolesAllowed": ["devops_engineer", "approver"],
  "requiresApproval": true,
  "allowedWorkflowIds": ["deploy-staging.yml"]
}
```

## Definition of done

- A user can sign in, select an authorized project/environment, and view an empty dashboard.
- Unauthorized API requests return `403` and are audited.
- Every user request receives a trace ID and audit-event record.
- CI runs lint, unit tests, type checks, and dependency vulnerability checks.
