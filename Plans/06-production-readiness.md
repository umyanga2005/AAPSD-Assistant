# Phase 6 - Production Readiness

## Goal

Make a deliberate go/no-go decision before connecting production systems.

## Production prerequisites

- Separate production credentials, service accounts, and namespaces.
- Production actions remain disabled by default.
- Two-person approval for production actions.
- Monitoring, alerting, backups, incident ownership, and support contacts are configured.
- A rollback path has been rehearsed for every enabled action.
- Legal/security owner approves LLM data handling and retention.

## Go/no-go checklist

- [ ] Staging release has operated successfully for the agreed observation period.
- [ ] Security review has approved integrations and access scopes.
- [ ] Runbooks exist for integration outage, job failure, token expiry, and rollback.
- [ ] Audit records are searchable and retained according to policy.
- [ ] On-call owner and escalation route are known.
- [ ] Client signs the production change-control document.

## Rollout approach

1. Enable production read-only dashboards.
2. Enable recommendation-only mode.
3. Enable one low-risk, approved production action for a small pilot group.
4. Review audit data and incidents weekly.
5. Expand only after explicit client approval.

