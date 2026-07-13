# Phase 0 - Discovery and Scope

## Goal

Turn the academic methodology into an agreed product scope before writing application code.

## Work items

1. Identify the first client environment: GitHub organization, test repository, Kubernetes staging namespace, and Prometheus endpoint.
2. Define user roles: Viewer, Developer, DevOps Engineer, Approver, Administrator.
3. Define actions allowed in the MVP.
4. Classify every action as read-only, approval-required, or prohibited.
5. Prepare safe test data: failed workflows, pod crash logs, API 500 logs, and high-CPU metric data.
6. Agree on LLM provider, data-retention rules, and which data may leave the client network.

## MVP action matrix

| Action                                | MVP status | Rule                              |
| ------------------------------------- | ---------- | --------------------------------- |
| View pipeline status/logs             | Enabled    | Read-only                         |
| Analyze Kubernetes pod logs           | Enabled    | Read-only, secrets redacted       |
| View CPU/memory metrics               | Enabled    | Read-only                         |
| Trigger staging workflow              | Enabled    | Approval required                 |
| Scale staging deployment within limit | Enabled    | Approval required                 |
| Restart staging deployment            | Enabled    | Approval required                 |
| Apply Terraform                       | Deferred   | Never direct from AI in MVP       |
| Delete resources / change secrets     | Prohibited | Manual operational procedure only |

## Example acceptance criteria

```text
Given a Developer requests "run the staging pipeline"
When the workflow is recognized and policy permits the request
Then the system shows a plan and waits for an Approver
And no GitHub workflow is triggered before approval.
```

## Deliverables

- Product requirements document
- Integration inventory and owner list
- Action matrix and approval matrix
- Threat model and data-classification decision
- Wireframes for dashboard, chat, plan approval, and audit log
- Seed test scenarios

## Definition of done

- Client approves MVP boundaries.
- Sandbox credentials exist and are least-privilege.
- Team agrees that production control is out of the first release.
