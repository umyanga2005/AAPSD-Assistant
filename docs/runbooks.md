# Operational Runbooks

## Overview

This document contains operational procedures for responding to common production issues in the AAPSD-Assistant platform.

## 1. Provider Outage (e.g., OpenRouter or LLM API failure)

**Symptoms:**

- `api_llm_requests_total` metric shows high error rate.
- Alerts trigger for `LLMProviderUnavailable`.
- Diagnoses are failing or timing out.

**Actions:**

1. Check [OpenRouter Status](https://openrouter.ai/status) or the specific model provider's status page.
2. If it is a widespread provider issue, communicate the degraded service state to users.
3. If only a specific model is affected, update the application configuration (`model-provider`) to fallback to a different model.
4. Scale out the application if timeouts are causing thread pool starvation.

## 2. Token Expiry (GitHub, K8s, Terraform credentials)

**Symptoms:**

- Alert `IntegrationAuthenticationFailed` triggers.
- Logs show 401 Unauthorized or 403 Forbidden errors when executing jobs.
- Integrations are failing in verification steps.

**Actions:**

1. Identify the failing integration from the alert labels or logs.
2. Generate a new token or credential via the respective platform's security portal.
3. Update the secrets manager (e.g., Vault, AWS Secrets Manager) or Kubernetes Secrets with the new value.
4. Restart the API service or trigger a config reload.

## 3. Executor Failure

**Symptoms:**

- Alert `ExecutorJobFailureRateHigh` triggers.
- Jobs in BullMQ enter the `failed` state repeatedly.
- Users report actions not taking effect.

**Actions:**

1. Inspect structured logs for the `traceId` associated with the failed jobs.
2. Verify if the issue is a permissions problem (RBAC) on the target system.
3. If it is a transient error, rely on the job queue's backoff and retry mechanism.
4. If it is a persistent bug in the executor, pause the queue, deploy a hotfix, and retry the dead-letter queue.

## 4. Approval Failure (Webhook / Signing issues)

**Symptoms:**

- Webhook signature validation errors in logs.
- Approvals are not propagating to the execution phase.

**Actions:**

1. Validate that the external system's webhook secret matches the configured `WEBHOOK_SECRET`.
2. Check for clock skew between the platform and the approval system if timestamp validation fails.
3. Review payload structure changes from the external system.

## 5. Rollback Procedure

**Symptoms:**

- Critical bugs introduced in the latest deployment.
- High error rates across multiple endpoints.

**Actions:**

1. Identify the previous stable commit or image tag.
2. Initiate a rollback via the CI/CD pipeline or directly via `kubectl rollout undo deployment/api-server`.
3. If database migrations were applied, assess if a downward migration is necessary (WARNING: downward migrations may cause data loss). Ensure DB backups are taken before rolling back schema changes.
