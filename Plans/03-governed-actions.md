# Phase 3 - Governed DevOps Actions

## Goal

Allow a narrow set of safe staging actions through a policy-controlled approval flow.

## Supported actions

1. Trigger an approved GitHub Actions workflow in staging.
2. Restart an allowed staging Kubernetes deployment.
3. Scale an allowed staging deployment within a configured min/max range.

## Required execution flow

```text
Natural-language request
  -> structured plan
  -> policy validation
  -> human approval
  -> executor job
  -> result/health verification
  -> immutable audit event
```

## Example plan shown to the user

```text
Action: Scale `api` deployment
Environment: staging
Current replicas: 2
Requested replicas: 3
Allowed range: 2-5
Risk: Low - staging only
Approval: Required from DevOps Approver
Verification: Confirm all 3 pods are Ready within 5 minutes
```

## Executor rules

- Accept only validated, typed action arguments; never execute model-generated shell commands.
- Use separate service accounts per environment and namespace.
- Make actions idempotent where possible.
- Add retries only for known transient failures.
- Record request, plan version, approver, tool call, result, and verification output.

## Definition of done

- No mutable action can bypass policy or approval.
- Rejected/expired approvals cannot be executed.
- Each action reports a final success, failure, or timed-out verification state.
- Integration tests use a sandbox cluster and test GitHub workflow.
