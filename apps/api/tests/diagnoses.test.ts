import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../src/db/schema.js';
import type { DiagnosisResult } from '@aapsd/contracts';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { users } from '../src/db/schema.js';
import * as dbModule from '../src/db/index.js';

vi.mock('../src/db/index.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('@aapsd/diagnosis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aapsd/diagnosis')>();
  return {
    ...actual,
    runDiagnosis: vi.fn(),
  };
});

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEV_PROJECT_ID = '00000000-0000-0000-0000-000000000002';
const DEV_ENV_ID = '00000000-0000-0000-0000-000000000003';

const mockUserLimit = vi.fn();
const mockUserWhere = vi.fn(() => ({ limit: mockUserLimit }));
const mockFrom = vi.fn((table: unknown) => {
  if (table === users) return { where: mockUserWhere };
  return { where: mockUserWhere };
});
const mockInsertValues = vi.fn();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const mockDb: NodePgDatabase<typeof schema> = {
  insert: mockInsert,
  select: mockSelect,
} as unknown as NodePgDatabase<typeof schema>;

const FAKE_RESULT: DiagnosisResult = {
  requestId: 'req-1',
  summary: 'Deployment failed due to missing image',
  evidence: [{ source: 'github', title: 'Job log', detail: 'line 124: ImagePullBackOff' }],
  likely_causes: [{ description: 'Image not found in registry', probability: 0.9 }],
  recommendations: [{ action: 'Verify build pipeline', details: 'Check image tag' }],
  confidence: 'high',
  needs_human_review: false,
  redacted: true,
  traceId: 'trace-1',
};

function validBody() {
  return {
    projectId: DEV_PROJECT_ID,
    environmentId: DEV_ENV_ID,
    query: 'Why did the deployment fail?',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(dbModule.getDb).mockReturnValue(mockDb as any);
  mockInsertValues.mockResolvedValue(undefined);
  mockUserLimit.mockResolvedValue([
    { id: DEV_USER_ID, email: 'dev@local', name: 'Dev', role: 'developer' },
  ]);
});

describe('POST /api/v1/diagnoses', () => {
  it('returns 200 with diagnosis result on valid request', async () => {
    const { runDiagnosis } = await import('@aapsd/diagnosis');
    vi.mocked(runDiagnosis).mockResolvedValue(FAKE_RESULT);

    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/diagnoses',
      headers: { 'x-dev-user-id': DEV_USER_ID, 'x-dev-role': 'developer' },
      payload: validBody(),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as DiagnosisResult;
    expect(body.summary).toBe(FAKE_RESULT.summary);
    expect(body.confidence).toBe('high');
    expect(body.evidence).toHaveLength(1);
    expect(body.needs_human_review).toBe(false);
    await app.close();
  });

  it('creates a request record and audits it', async () => {
    const { runDiagnosis } = await import('@aapsd/diagnosis');
    vi.mocked(runDiagnosis).mockResolvedValue(FAKE_RESULT);

    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/diagnoses',
      headers: { 'x-dev-user-id': DEV_USER_ID, 'x-dev-role': 'developer' },
      payload: validBody(),
    });

    expect(mockInsert).toHaveBeenCalled();
    const requestInsert = mockInsertValues.mock.calls[0][0];
    expect(requestInsert).toMatchObject({
      userId: DEV_USER_ID,
      projectId: DEV_PROJECT_ID,
      environmentId: DEV_ENV_ID,
      action: 'diagnose',
      status: 'completed',
    });

    const auditInsert = mockInsertValues.mock.calls[1][0];
    expect(auditInsert).toMatchObject({
      eventType: 'request.created',
      targetType: 'diagnosis',
    });
    await app.close();
  });

  it('returns 401 without X-Dev-User-Id header', async () => {
    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/diagnoses',
      payload: validBody(),
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toMatch(/provide Authorization header/);
    await app.close();
  });

  it('returns 400 with missing required fields', async () => {
    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/diagnoses',
      headers: { 'x-dev-user-id': DEV_USER_ID },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Validation failed');
    expect(body.details.length).toBeGreaterThanOrEqual(3);
    await app.close();
  });

  it('returns 400 with non-object JSON body', async () => {
    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/diagnoses',
      headers: { 'x-dev-user-id': DEV_USER_ID, 'content-type': 'application/json' },
      payload: '"a plain string, not an object"',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Validation failed');
    await app.close();
  });

  it('returns 400 when query is an empty string', async () => {
    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/diagnoses',
      headers: { 'x-dev-user-id': DEV_USER_ID },
      payload: { projectId: DEV_PROJECT_ID, environmentId: DEV_ENV_ID, query: '' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.details.some((d: string) => d.includes('query'))).toBe(true);
    await app.close();
  });
});
