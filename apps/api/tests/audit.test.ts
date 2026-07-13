import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeMetadata } from '../src/services/audit.js';
import * as dbModule from '../src/db/index.js';

vi.mock('../src/db/index.js', () => ({
  getDb: vi.fn(),
}));

const mockOffset = vi.fn();
const mockLimit = vi.fn(() => ({ offset: mockOffset }));
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockInsert = vi.fn(() => ({ values: vi.fn() }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dbModule.getDb).mockReturnValue(mockDb);
});

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
    const result = sanitizeMetadata(input);
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
    const mockValues = vi.fn();
    mockInsert.mockReturnValue({ values: mockValues });

    const { recordAuditEvent } = await import('../src/services/audit.js');
    await recordAuditEvent({
      actorId: '00000000-0000-0000-0000-000000000001',
      projectId: '00000000-0000-0000-0000-000000000002',
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

    const inserted = mockValues.mock.calls[0][0];
    expect(inserted).toMatchObject({
      actorId: '00000000-0000-0000-0000-000000000001',
      projectId: '00000000-0000-0000-0000-000000000002',
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
    const mockValues = vi.fn();
    mockInsert.mockReturnValue({ values: mockValues });

    const { recordAuditEvent } = await import('../src/services/audit.js');
    await recordAuditEvent({
      actorId: '00000000-0000-0000-0000-000000000001',
      projectId: '00000000-0000-0000-0000-000000000002',
      eventType: 'authorization.denied',
      traceId: 'trace-2',
      targetType: 'request',
      targetId: '00000000-0000-0000-0000-000000000003',
    });

    const inserted = mockValues.mock.calls[0][0];
    expect(inserted.metadata).toEqual({});
  });
});

describe('getAuditEventsByProject', () => {
  it('calls db.select chain and returns result', async () => {
    const expected = [{ id: 'event-1', eventType: 'request.created' }];
    mockOffset.mockResolvedValue(expected);

    const { getAuditEventsByProject } = await import('../src/services/audit.js');

    const result = await getAuditEventsByProject('00000000-0000-0000-0000-000000000002');

    expect(mockSelect).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledOnce();
    expect(mockWhere).toHaveBeenCalledOnce();
    expect(mockOrderBy).toHaveBeenCalledOnce();
    expect(mockLimit).toHaveBeenCalledOnce();
    expect(mockOffset).toHaveBeenCalledOnce();
    expect(result).toEqual(expected);
  });
});

describe('GET /api/audit-events', () => {
  it('returns 400 when project_id is missing', async () => {
    const { buildApp } = await import('../src/index.js');
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/audit-events',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Query parameter project_id is required');
    await app.close();
  });

  it('returns 200 with audit events', async () => {
    const { buildApp } = await import('../src/index.js');
    const app = buildApp();
    mockOffset.mockResolvedValue([{ id: 'event-1', eventType: 'request.created' }]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/audit-events?project_id=00000000-0000-0000-0000-000000000002',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].eventType).toBe('request.created');
    await app.close();
  });
});
