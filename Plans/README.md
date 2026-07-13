# Smart DevOps Assistant - Delivery Plan

This folder converts the methodology into a safe, professional implementation plan. Build phases in order; do not enable production-changing actions until Phase 6 has passed.

## Delivery sequence

| Phase | File                            | Outcome                                               |
| ----- | ------------------------------- | ----------------------------------------------------- |
| 0     | `00-discovery-and-scope.md`     | Approved scope, integrations, security rules          |
| 1     | `01-foundation.md`              | Working application foundation, identity, audit trail |
| 2     | `02-read-only-intelligence.md`  | CI/CD, logs, metrics, and AI diagnosis                |
| 3     | `03-governed-actions.md`        | Approved, allow-listed DevOps actions                 |
| 4     | `04-hardening-and-devsecops.md` | Secure, resilient, observable system                  |
| 5     | `05-release-and-evaluation.md`  | UAT-ready release and project evaluation              |
| 6     | `06-production-readiness.md`    | Production go/no-go decision                          |

Use `07-final-system-checklist.md` before each release and `08-small-task-backlog.md` to assign individual development tasks.

## Non-negotiable safety rule

The AI can explain and propose a plan. Only the policy-controlled executor can call DevOps APIs. The executor must use least-privilege credentials and require approval for protected actions.
