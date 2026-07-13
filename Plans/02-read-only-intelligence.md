# Phase 2 - Read-Only Intelligence

## Goal

Provide useful DevOps insight without making any infrastructure changes.

## Integrations

- GitHub App: repository metadata, Actions workflow runs, jobs, and logs.
- Kubernetes: namespace-scoped pod status, events, deployment status, and logs.
- Prometheus: CPU, memory, restarts, latency, and error-rate queries.
- Knowledge base: approved runbooks and platform documentation indexed for retrieval.

## Agent design

Use a deterministic workflow, not a free-running autonomous agent:

```text
Request -> authorize -> collect evidence -> redact -> retrieve runbook -> analyze
        -> validate structured response -> show evidence and confidence
```

The model response must be JSON with `summary`, `evidence`, `likely_causes`, `recommendations`, `confidence`, and `needs_human_review` fields.

## Example user result

```text
Request: Why did the latest staging deployment fail?

Summary: The deploy job failed because image `api:sha-3bc` was not found.
Evidence: GitHub Actions job "Deploy" line 124; Kubernetes event ImagePullBackOff.
Recommended next step: Verify image build/push job and image tag configuration.
Confidence: High
```

## Screens

- Pipeline dashboard: workflow status, duration, failed jobs, link to original run.
- Incident page: evidence timeline, diagnosis, recommendations, confidence.
- Infrastructure health page: pod state, restarts, CPU, memory, alerts.
- Chat page: request history and cited system evidence.

## Definition of done

- System diagnoses each seeded failure scenario with evidence links.
- Secrets and tokens are redacted before model calls and before UI display.
- AI cannot trigger API mutations in this phase.
- Automated tests cover failed API calls, malformed logs, LLM timeouts, and no-evidence cases.

