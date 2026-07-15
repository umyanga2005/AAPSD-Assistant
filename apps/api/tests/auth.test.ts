import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../src/db/schema.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { users, projectMembers } from '../src/db/schema.js';
import * as dbModule from '../src/db/index.js';

vi.mock('../src/db/index.js', () => ({
  getDb: vi.fn(),
}));

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEV_PROJECT_ID = '00000000-0000-0000-0000-000000000002';

const mockUserLimit = vi.fn();
const mockUserWhere = vi.fn(() => ({ limit: mockUserLimit }));
const mockMemberLimit = vi.fn().mockImplementation((...args) => {
  console.log('mockMemberLimit called', args);
  return [];
});
const mockMemberWhere = vi.fn((...args) => {
  console.log('mockMemberWhere called', args);
  return { limit: mockMemberLimit };
});
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
  return { where: mockAuditWhere };
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
  mockInsertValues.mockResolvedValue(undefined);
});

describe('hasRole', () => {
  it('allows viewer to access viewer-required endpoints', async () => {
    const { hasRole } = await import('../src/services/auth.js');
    expect(hasRole('viewer', 'viewer')).toBe(true);
    expect(hasRole('viewer', 'developer')).toBe(false);
    expect(hasRole('viewer', 'approver')).toBe(false);
    expect(hasRole('viewer', 'devops_engineer')).toBe(false);
    expect(hasRole('viewer', 'administrator')).toBe(false);
  });

  it('allows administrator to access any endpoint', async () => {
    const { hasRole } = await import('../src/services/auth.js');
    for (const role of [
      'viewer',
      'developer',
      'approver',
      'devops_engineer',
      'administrator',
    ] as const) {
      expect(hasRole('administrator', role)).toBe(true);
    }
  });

  it('enforces hierarchy between adjacent roles', async () => {
    const { hasRole } = await import('../src/services/auth.js');
    expect(hasRole('developer', 'viewer')).toBe(true);
    expect(hasRole('approver', 'developer')).toBe(true);
    expect(hasRole('devops_engineer', 'approver')).toBe(true);
  });
});

describe('resolveDevUser', () => {
  it('resolves existing user from DB', async () => {
    mockUserLimit.mockResolvedValue([
      { id: DEV_USER_ID, email: 'alice@test', name: 'Alice', role: 'developer' },
    ]);

    const { resolveDevUser } = await import('../src/services/auth.js');
    const user = await resolveDevUser(DEV_USER_ID);

    expect(user).toMatchObject({
      id: DEV_USER_ID,
      email: 'alice@test',
      name: 'Alice',
      role: 'developer',
    });
  });

  it('auto-creates user when not found', async () => {
    mockUserLimit.mockResolvedValue([]);

    const { resolveDevUser } = await import('../src/services/auth.js');
    const user = await resolveDevUser(DEV_USER_ID);

    expect(user).toMatchObject({ id: DEV_USER_ID, role: 'viewer' });
    expect(user.email).toMatch(/@dev\.local$/);
    expect(mockInsert).toHaveBeenCalled();
  });

  it('respects role override for existing user', async () => {
    mockUserLimit.mockResolvedValue([
      { id: DEV_USER_ID, email: 'bob@test', name: 'Bob', role: 'viewer' },
    ]);

    const { resolveDevUser } = await import('../src/services/auth.js');
    const user = await resolveDevUser(DEV_USER_ID, 'administrator');

    expect(user.role).toBe('administrator');
  });
});

describe('getProjectRole', () => {
  it('returns role when membership exists', async () => {
    mockMemberLimit.mockResolvedValue([
      { projectId: DEV_PROJECT_ID, userId: DEV_USER_ID, role: 'developer' },
    ]);

    const { getProjectRole } = await import('../src/services/auth.js');
    const role = await getProjectRole(DEV_USER_ID, DEV_PROJECT_ID);

    expect(role).toBe('developer');
  });

  it('returns null when no membership', async () => {
    mockMemberLimit.mockResolvedValue([]);

    const { getProjectRole } = await import('../src/services/auth.js');
    const role = await getProjectRole(DEV_USER_ID, DEV_PROJECT_ID);

    expect(role).toBeNull();
  });
});

describe('GET /api/audit-events (auth)', () => {
  it('returns 401 without X-Dev-User-Id header', async () => {
    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/audit-events?project_id=${DEV_PROJECT_ID}`,
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toMatch(/provide Authorization header/);
    await app.close();
  });

  it('returns 403 without project membership', async () => {
    mockUserLimit.mockResolvedValue([
      { id: DEV_USER_ID, email: 'dev@local', name: 'Dev', role: 'viewer' },
    ]);
    mockMemberLimit.mockResolvedValue([]);

    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/audit-events?project_id=${DEV_PROJECT_ID}`,
      headers: { 'x-dev-user-id': DEV_USER_ID, 'x-dev-role': 'viewer' },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error).toMatch(/insufficient project role/);
    await app.close();
  });

  it('records audit event on denied access', async () => {
    mockUserLimit.mockResolvedValue([
      { id: DEV_USER_ID, email: 'dev@local', name: 'Dev', role: 'viewer' },
    ]);
    mockMemberLimit.mockResolvedValue([]);

    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    await app.inject({
      method: 'GET',
      url: `/api/audit-events?project_id=${DEV_PROJECT_ID}`,
      headers: { 'x-dev-user-id': DEV_USER_ID, 'x-dev-role': 'viewer' },
    });

    expect(mockInsert).toHaveBeenCalled();
    const inserted = mockInsertValues.mock.calls[0][0];
    expect(inserted.eventType).toBe('authorization.denied');
    expect(inserted.projectId).toBe(DEV_PROJECT_ID);
    expect(inserted.metadata.reason).toBe('insufficient_role');
    await app.close();
  });

  it('allows administrator without explicit membership', async () => {
    mockUserLimit.mockResolvedValue([
      { id: DEV_USER_ID, email: 'admin@local', name: 'Admin', role: 'administrator' },
    ]);
    mockAuditOffset.mockResolvedValue([{ id: 'event-1', eventType: 'request.created' }]);

    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/audit-events?project_id=${DEV_PROJECT_ID}`,
      headers: { 'x-dev-user-id': DEV_USER_ID, 'x-dev-role': 'administrator' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    await app.close();
  });

  it('allows viewer with project membership', async () => {
    mockUserLimit.mockResolvedValue([
      { id: DEV_USER_ID, email: 'dev@local', name: 'Dev', role: 'viewer' },
    ]);
    mockMemberLimit.mockResolvedValue([
      { projectId: DEV_PROJECT_ID, userId: DEV_USER_ID, role: 'viewer' },
    ]);
    mockAuditOffset.mockResolvedValue([{ id: 'event-1', eventType: 'request.created' }]);

    const { buildApp } = await import('../src/index.js');
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/audit-events?project_id=${DEV_PROJECT_ID}`,
      headers: { 'x-dev-user-id': DEV_USER_ID, 'x-dev-role': 'viewer' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    await app.close();
  });
});
