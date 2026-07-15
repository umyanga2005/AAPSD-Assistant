import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../src/db/schema.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeMetadata } from '../src/services/audit.js';
import { users, projectMembers } from '../src/db/schema.js';
import * as dbModule from '../src/db/index.js';

vi.mock('../src/db/index.js', () => ({
  getDb: vi.fn(),
}));

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEV_PROJECT_ID = '00000000-0000-0000-0000-000000000002';

const mockUserLimit = vi.fn();
const mockUserWhere = vi.fn(() => ({ limit: mockUserLimit }));
const mockMemberLimit = vi.fn().mockResolvedValue([{ role: 'developer' }]);
const mockMemberWhere = vi.fn(() => ({ limit: mockMemberLimit }));
const mockAuditOffset = vi.fn();
const mockAuditLimit = vi.fn(() => ({ offset: mockAuditOffset }));
const mockAuditOrderBy = vi.fn(() => ({ limit: mockAuditLimit }));
const mockAuditWhere = vi.fn(() => ({ orderBy: mockAuditOrderBy }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn((table: any) => {
  const tName =
    (table && table[Symbol.for('drizzle:Name')]) ||
    (table && table._ && table._.name) ||
    (table && table.name) ||
    '';
  if (table === users || tName === 'users') return { where: mockUserWhere };
  if (table === projectMembers || tName === 'project_members' || tName === 'projectMembers')
    return { where: mockMemberWhere };
  return { where: mockAuditWhere, orderBy: mockAuditOrderBy };
});
const mockInsertValues = vi.fn();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const mockDb: NodePgDatabase<typeof schema> = {
  insert: mockInsert,
  select: mockSelect,
} as unknown as NodePgDatabase<typeof schema>;

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(dbModule.getDb).mockReturnValue(mockDb as any);
  mockUserLimit.mockResolvedValue([
    { id: DEV_USER_ID, email: 'dev@local', name: 'Dev', role: 'viewer' },
  ]);
  mockMemberLimit.mockResolvedValue([
    { projectId: DEV_PROJECT_ID, userId: DEV_USER_ID, role: 'viewer' },
  ]);
});

const COMMON_HEADERS = {
  'x-dev-user-id': DEV_USER_ID,
  'x-dev-role': 'viewer',
};

describe('sanitizeMetadata', () => {
  it('strips top-level sensitive keys', () => {
    const input = {
      apiKey: 'sk-abc123',
      password: 'hunter2',
      token: 'eyJhbGci',
      Authorization: 'Bearer xyz',
      secret: 'topsecret',
      private_key: '-----BEGIN RSA PRIVATE KEY-----',
      safeField: 'hello',
      count: 42,
    };
    const result = sanitizeMetadata(input);
    expect(result).not.toHaveProperty('apiKey');
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('Authorization');
    expect(result).not.toHaveProperty('secret');
    expect(result).not.toHaveProperty('private_key');
    expect(result).toHaveProperty('safeField', 'hello');
    expect(result).toHaveProperty('count', 42);
  });

  it('strips sensitive keys from nested objects', () => {
    const input = {
      user: { name: 'Alice', apiKey: 'sk-xxx' },
      config: { endpoint: '/api', secret: 's3cr3t' },
    };
    const result = sanitizeMetadata(input);
    expect(result.user).not.toHaveProperty('apiKey');
    expect(result.config).not.toHaveProperty('secret');
    expect(result.user).toHaveProperty('name', 'Alice');
    expect(result.config).toHaveProperty('endpoint', '/api');
  });

  it('strips sensitive keys from arrays of objects', () => {
    const input = {
      items: [
        { id: 1, token: 'abc' },
        { id: 2, safe: true },
      ],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = sanitizeMetadata(input) as any;
    expect(result.items[0]).not.toHaveProperty('token');
    expect(result.items[0]).toHaveProperty('id', 1);
    expect(result.items[1]).toHaveProperty('safe', true);
  });

  it('preserves non-sensitive fields', () => {
    const input = {
      action: 'deploy',
      environment: 'production',
      version: 'v1.2.3',
      success: true,
      tags: ['stable'],
    };
    const result = sanitizeMetadata(input);
    expect(result).toEqual(input);
  });

  it('handles empty metadata', () => {
    expect(sanitizeMetadata({})).toEqual({});
  });

  it('handles various sensitive key patterns', () => {
    const input = {
      api_key: 'value1',
      'api-key': 'value2',
      access_token: 'value3',
      refreshToken: 'value4',
      credentials: 'value5',
      auth: 'value6',
      passwd: 'value7',
    };
    const result = sanitizeMetadata(input);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('recordAuditEvent', () => {
  it('calls db.insert with sanitized values', async () => {
    const { recordAuditEvent } = await import('../src/services/audit.js');
    await recordAuditEvent({
      actorId: DEV_USER_ID,
      projectId: DEV_PROJECT_ID,
      eventType: 'request.created',
      traceId: 'trace-1',
      targetType: 'request',
      targetId: '00000000-0000-0000-0000-000000000003',
      metadata: {
        query: 'SELECT 1',
        apiKey: 'sk-xxx',
        nested: { token: 'abc', safeKey: 123 },
      },
    });

    expect(mockInsert).toHaveBeenCalledOnce();

    const inserted = mockInsertValues.mock.calls[0][0];
    expect(inserted).toMatchObject({
      actorId: DEV_USER_ID,
      projectId: DEV_PROJECT_ID,
      eventType: 'request.created',
      traceId: 'trace-1',
      targetType: 'request',
      targetId: '00000000-0000-0000-0000-000000000003',
    });
    expect(inserted.metadata).not.toHaveProperty('apiKey');
    expect(inserted.metadata.nested).not.toHaveProperty('token');
    expect(inserted.metadata).toHaveProperty('query', 'SELECT 1');
    expect(inserted.metadata.nested).toHaveProperty('safeKey', 123);
  });

  it('handles record without metadata', async () => {
    const { recordAuditEvent } = await import('../src/services/audit.js');
    await recordAuditEvent({
      actorId: DEV_USER_ID,
      projectId: DEV_PROJECT_ID,
      eventType: 'authorization.denied',
      traceId: 'trace-2',
      targetType: 'request',
      targetId: '00000000-0000-0000-0000-000000000003',
    });

    const inserted = mockInsertValues.mock.calls[0][0];
    expect(inserted.metadata).toEqual({});
  });
});

describe('getAuditEventsByProject', () => {
  it('calls db.select chain and returns result', async () => {
    const { getAuditEventsByProject } = await import('../src/services/audit.js');
    const expected = [{ id: 'event-1', eventType: 'request.created' }];
    mockAuditOffset.mockResolvedValue(expected);

    const result = await getAuditEventsByProject(DEV_PROJECT_ID);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockAuditOffset).toHaveBeenCalled();
    expect(result).toEqual(expected);
  });
});

describe('GET /api/audit-events', () => {
  it('returns 200 and all events when project_id is missing', async () => {
    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/audit-events',
      headers: COMMON_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    await app.close();
  });

  it('returns 200 with audit events', async () => {
    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    mockAuditOffset.mockResolvedValue([{ id: 'event-1', eventType: 'request.created' }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/audit-events?project_id=${DEV_PROJECT_ID}`,
      headers: COMMON_HEADERS,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].eventType).toBe('request.created');
    await app.close();
  });
});
