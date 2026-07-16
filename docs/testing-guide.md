# AAPSD-Assistant Comprehensive Testing Guide

This guide provides complete instructions for verifying the AAPSD-Assistant platform, encompassing both automated test suites and structured manual testing scenarios. Since the system handles governed operations, rigorous verification across different deployment profiles is critical.

---

## 1. Automated Testing

The project uses `vitest` for fast, native TypeScript testing, alongside `eslint` and `tsc` for static analysis.

### Running the Full Suite

To completely verify the codebase locally before any commit, execute the following from the root directory or within `apps/api`:

```bash
# 1. Typechecking (Ensure no TypeScript errors exist)
npm run typecheck

# 2. Linting (Ensure code style and best practices)
npm run lint

# 3. Unit & Integration Tests
npm run test
```

### Test Coverage Areas

- **Executor Engine (`github-executor.test.ts`, `kubernetes-executor.test.ts`)**: Validates that safe commands are constructed and idempotency keys are respected.
- **Config & Profiles (`config.test.ts`, `profiles.test.ts`)**: Validates that `local-lite`, `staging-remote`, and `full-container` profiles enforce correct environment variables.
- **Security & Policies (`actions.test.ts`, `security.test.ts`, `auth.test.ts`)**: Ensures strict access controls, verifying that users cannot approve their own requests unless authorized, and that destructive actions are blocked.
- **Audit Logging (`audit.test.ts`)**: Confirms every system interaction produces an immutable audit record.

---

## 2. Deployment Profile Testing

The system supports three strict deployment profiles. You must test the relevant profile depending on your environment constraints.

### A. Local-Lite (Resource Constrained)

Designed for low-memory environments (e.g., 8GB laptops) without Docker or Kubernetes.

1. Copy `.env.local-lite.example` to `.env`.
2. Ensure `DEPLOYMENT_PROFILE=local-lite`.
3. Start the system natively (`npm start` in `apps/api`, `npm run dev` in `apps/web`).
4. **Verification**:
   - Check the top header in the UI; it should display the **Local Lite Simulation** badge.
   - Attempt to execute a Governed Action. It **must** fail with a `403` error stating "Mutable actions disabled in local-lite mode."

### B. Staging-Remote (Hybrid)

Designed for connecting a local UI/API to real cloud infrastructure (e.g., remote Redis, remote Kubernetes or a local Minikube cluster).

1. Copy standard `.env.example` to `.env`.
2. Set `DEPLOYMENT_PROFILE=staging-remote`.
3. Provide real external credentials (`REDIS_URL`, `K8S_TOKEN`, etc.).
   _Note: If testing with Minikube locally, run `.\scripts\setup-minikube.ps1` to automatically generate your `K8S_TOKEN` and `K8S_API_SERVER_URL`._
4. **Verification**:
   - Check the top header for the **Remote Staging** badge.
   - Ensure the job queue successfully connects to the remote Redis instance without crashing.

### C. Full-Container (Production Parity)

Runs the entire stack locally via Docker Compose.

1. Run `docker-compose -f infra/docker/docker-compose.yml up -d`.
2. **Verification**:
   - Check the top header for the **Full Container** badge.
   - Verify all services (PostgreSQL, Redis, API, Web) are running via `docker ps`.

---

## 3. Manual Testing Scenarios

When performing manual QA, follow these scenarios to ensure core loops function securely.

### Scenario 1: Authentication & Role-Based Access

1. Log in to the Web App.
2. Attempt to view the **Audit Logs** and **Infrastructure** tabs.
3. If the user does not have the `viewer`, `developer`, or `administrator` role for a project, the API should return a `403 Forbidden` error.

### Scenario 2: Intelligence & Diagnosis

1. Navigate to the **Assistant** page.
2. Submit a natural language query (e.g., "Why is the backend-api pod crashing?").
3. **Expected Result**:
   - The UI shows a loading state.
   - The API uses the mock or real Kubernetes adapters to collect evidence.
   - The LLM streams or returns a diagnosis payload outlining the root cause.

### Scenario 3: The Governed Action Lifecycle

This is the most critical flow to verify.

1. **Request**: As a `developer`, navigate to **Governed Actions** and propose an action (e.g., `kubernetes.deployment.restart`).
2. **Policy Evaluation**: The system evaluates the request against rules in `AGENTS.md` and configuration limits. If the scale is within bounds (e.g., `ACTION_MAX_SCALE`), it is saved as `pending`.
3. **Approval**: Log in as an `approver` or `administrator`. Review the pending action plan and click **Approve**.
4. **Execution**: Click **Execute**.
   - If in `local-lite`, this must be rejected.
   - If in `staging-remote` or `full-container`, a job is enqueued in Redis.
5. **Verification**: Verify the execution succeeded and the target infrastructure state changed.

### Scenario 4: Audit Log Verification

1. Navigate to the **Audit Log** page.
2. Ensure you can see chronological entries for:
   - Your login event.
   - The creation of the action plan from Scenario 3.
   - The approval event.
   - The execution success/failure event.
3. Verify that `traceId` and `actorId` fields are correctly populated for forensic traceability.

### Scenario 5: Observability & Health

1. Send a `GET /api/v1/health` request to the API.
   - **Expected Result**: Returns `200 OK` with `{ status: "ok", db: "connected", profile: "..." }`.
2. Send a `GET /metrics` request.
   - **Expected Result**: Returns raw Prometheus text format output containing metrics like `api_http_request_duration_seconds` and `api_executor_jobs_total`.
