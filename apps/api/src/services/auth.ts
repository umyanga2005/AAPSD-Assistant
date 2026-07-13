import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users, projectMembers } from '../db/schema.js';

export type Role = 'viewer' | 'developer' | 'approver' | 'devops_engineer' | 'administrator';

export const ROLES: Role[] = [
  'viewer',
  'developer',
  'approver',
  'devops_engineer',
  'administrator',
];

export const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 1,
  developer: 2,
  approver: 3,
  devops_engineer: 4,
  administrator: 5,
};

export interface DevUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function isRole(value: string): value is Role {
  return ROLES.includes(value as Role);
}

function defaultEmail(id: string): string {
  return `${id.slice(0, 8)}@dev.local`;
}

function defaultName(id: string): string {
  return `Dev User ${id.slice(0, 8)}`;
}

export async function resolveDevUser(devUserId: string, roleOverride?: Role): Promise<DevUser> {
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.id, devUserId)).limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: roleOverride ?? (user.role as Role),
    };
  }

  const role = roleOverride ?? 'viewer';
  await db.insert(users).values({
    id: devUserId,
    email: defaultEmail(devUserId),
    name: defaultName(devUserId),
    role,
  });

  return { id: devUserId, email: defaultEmail(devUserId), name: defaultName(devUserId), role };
}

export async function getProjectRole(userId: string, projectId: string): Promise<Role | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  return rows.length > 0 ? (rows[0].role as Role) : null;
}
