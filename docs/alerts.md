# Alert Definitions

## Overview

This document outlines the primary alert definitions for monitoring the health and performance of the AAPSD-Assistant platform. These rules can be implemented in Prometheus/Alertmanager.

## Alerts

### 1. High API Latency

- **Name:** `ApiHighLatency`
- **Condition:** 95th percentile of `api_http_request_duration_seconds` > 2 seconds for 5 minutes.
- **Severity:** Warning
- **Description:** API requests are taking longer than expected. Investigate DB performance or LLM API delays.

### 2. Unavailable Integrations

- **Name:** `IntegrationUnavailable`
- **Condition:** `api_integration_errors_total` rate > 5 per minute for 5 minutes.
- **Severity:** Critical
- **Description:** A configured integration (GitHub, K8s, Terraform) is returning errors or timing out. Check credentials and target system availability.

### 3. High Executor Job Failure Rate

- **Name:** `ExecutorJobFailureRateHigh`
- **Condition:** `api_executor_jobs_total{status="failed"}` rate > 10% of total jobs for 10 minutes.
- **Severity:** Critical
- **Description:** Background jobs executing actions are failing at a high rate. Check `runbooks.md` for Executor Failure procedures.

### 4. Queue Backlog

- **Name:** `QueueDepthHigh`
- **Condition:** `api_queue_depth_total` > 100 for 15 minutes.
- **Severity:** Warning
- **Description:** The BullMQ job queue has a high backlog of pending jobs. Workers might be stuck, slow, or insufficient to handle the load.

### 5. Abnormal LLM Usage (Cost Anomaly)

- **Name:** `AbnormalLLMUsage`
- **Condition:** `api_llm_usage_tokens_total` rate > 10,000 tokens per minute for 5 minutes.
- **Severity:** Warning
- **Description:** Unusually high token usage detected. Investigate potential prompt injection loops or abusive traffic.

### 6. Health Check Failure

- **Name:** `ServiceHealthCheckFailed`
- **Condition:** `/api/v1/health` endpoint returns non-200 status for 3 consecutive scrapes (1 minute).
- **Severity:** Critical
- **Description:** The main API service is failing its health checks (could be disconnected from DB or Redis).
