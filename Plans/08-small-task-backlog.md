# Small Task Backlog

Use these as assignable tasks. Each task should become a GitHub issue with an owner, estimate, and acceptance test.

## Foundation

- [ ] Create monorepo workspace and root README.
- [ ] Add TypeScript, ESLint, Prettier, and commit hooks.
- [ ] Create Docker Compose services for PostgreSQL and Redis.
- [ ] Add backend health and readiness endpoints.
- [ ] Create initial PostgreSQL migrations.
- [ ] Add GitHub OAuth/OIDC login.
- [ ] Implement role middleware and `403` error response.
- [ ] Create audit-event table and API helper.

## Frontend

- [ ] Create responsive dashboard layout.
- [ ] Build project/environment selector.
- [ ] Build chat request form with request history.
- [ ] Build plan-preview component.
- [ ] Build approval dialog and approval timeline.
- [ ] Build pipeline-run table and failure details view.
- [ ] Build Kubernetes health cards and metrics charts.
- [ ] Add accessible loading, empty, and error states.

## Integrations

- [ ] Register GitHub App and store encrypted installation details.
- [ ] Fetch GitHub workflow runs.
- [ ] Fetch GitHub job logs and redact sensitive fields.
- [ ] Create Kubernetes read-only client with namespace restriction.
- [ ] Fetch pod events, conditions, and recent logs.
- [ ] Create Prometheus query adapter.
- [ ] Add integration connection test page.

## AI and policy

- [ ] Define JSON schema for diagnosis responses.
- [ ] Define JSON schema for execution plans.
- [ ] Build redaction service with unit tests.
- [ ] Add approved runbook ingestion and retrieval.
- [ ] Build evidence collector.
- [ ] Build planner workflow with schema validation.
- [ ] Implement action policy evaluator.
- [ ] Add prompt-injection regression tests.

## Executor and quality

- [ ] Implement staging workflow-dispatch executor.
- [ ] Implement bounded staging scale executor.
- [ ] Implement staging restart executor.
- [ ] Add approval expiration and cancellation.
- [ ] Add execution-status polling and result verification.
- [ ] Add OpenTelemetry trace propagation.
- [ ] Add CI test, lint, type-check, and security-scan jobs.
- [ ] Write deployment, rollback, and incident runbooks.

