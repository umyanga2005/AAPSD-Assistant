# Phase 5 - Release and Evaluation

## Goal

Validate that the application solves real DevOps tasks and can be handed to users.

## Test groups

| Group | Focus |
|---|---|
| Unit | Policies, redaction, validation, integration adapters |
| Integration | GitHub, Kubernetes, Prometheus, database, queue, AI service |
| End-to-end | Diagnose failure, request action, approve, execute, verify |
| Security | RBAC, injection, secrets, webhook verification, audit completeness |
| Performance | API responsiveness, concurrent requests, job processing |
| UAT | Clarity, usefulness, trust, workflow completion |

## UAT scenarios

1. Diagnose a failed GitHub Actions deployment.
2. Explain an ImagePullBackOff pod failure using logs/events.
3. Review high CPU metrics and give a scaling recommendation.
4. Request and approve a staging workflow trigger.
5. Verify that an unauthorized user cannot scale a deployment.

## Metrics

- Diagnosis accuracy on curated scenarios.
- Percentage of responses with evidence.
- Action success and verification rate.
- Mean time to diagnose compared with manual review.
- User satisfaction and task completion rate.
- Zero secret leaks and 100% audited mutable actions.

## Deliverables

- Test report and defect register
- UAT feedback report
- User guide and administrator guide
- API/integration documentation
- Deployment and rollback runbook
- Project evaluation results

## Definition of done

- All critical and high defects are fixed or explicitly accepted by the client.
- UAT users complete agreed scenarios.
- Release candidate passes `07-final-system-checklist.md`.

