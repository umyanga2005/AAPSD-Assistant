# Final System Checking Tasks

Run this checklist before a release candidate is demonstrated, submitted, or deployed.

## Application

- [ ] Frontend builds without errors.
- [ ] Backend and AI service start from a clean Docker Compose environment.
- [ ] Health/readiness endpoints pass.
- [ ] Database migrations apply cleanly to a new database.
- [ ] No development secrets are committed.

## Identity and security

- [ ] Login, logout, session expiry, and role changes work.
- [ ] Viewer cannot access Developer/DevOps/Administrator endpoints.
- [ ] All mutable actions require a valid policy decision and approval.
- [ ] Redaction removes API keys, tokens, passwords, and connection strings from prompts/logs.
- [ ] Webhooks verify sender signatures.
- [ ] Dependency and container scans have no unaccepted critical findings.

## AI and evidence

- [ ] Responses use validated structured output.
- [ ] Diagnosis includes evidence source, timestamp, and confidence.
- [ ] Missing evidence produces an honest "insufficient evidence" response.
- [ ] Prompt-injection test is rejected and audited.
- [ ] Model failure returns a safe, useful error state.

## Integrations and actions

- [ ] GitHub workflow status/log retrieval works with test credentials.
- [ ] Kubernetes read-only health/log retrieval is namespace-restricted.
- [ ] Prometheus queries render correct metrics.
- [ ] Staging workflow trigger requires approval and records result.
- [ ] Staging scale/restart actions validate allowed resources and limits.
- [ ] Failed actions show a clear error and do not retry dangerously.

## Reliability and operations

- [ ] Unit, integration, end-to-end, and security suites pass.
- [ ] Queue retry/dead-letter behavior is tested.
- [ ] Audit records contain user, action, policy, approval, result, and trace ID.
- [ ] Dashboards and alerts are available.
- [ ] Backup and restore procedure is tested.
- [ ] Deployment and rollback runbooks have been reviewed.

## Sign-off

| Role | Name | Date | Decision |
|---|---|---|---|
| Product/client owner |  |  |  |
| Technical lead |  |  |  |
| Security reviewer |  |  |  |
| DevOps owner |  |  |  |

