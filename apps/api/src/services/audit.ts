import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { auditEvents } from '../db/schema.js';

export const AUDIT_ACTION_PLAN_CREATED = 'action.plan.created';
export const AUDIT_ACTION_PLAN_DENIED = 'action.plan.denied';
export const AUDIT_ACTION_PLAN_APPROVED = 'action.plan.approved';
export const AUDIT_ACTION_PLAN_REJECTED = 'action.plan.rejected';
export const AUDIT_ACTION_PLAN_EXPIRED = 'action.plan.expired';
export const AUDIT_ACTION_EXECUTOR_QUEUED = 'action.executor.queued';
export const AUDIT_ACTION_EXECUTOR_RUNNING = 'action.executor.running';
export const AUDIT_ACTION_EXECUTOR_SUCCEEDED = 'action.executor.succeeded';
export const AUDIT_ACTION_EXECUTOR_FAILED = 'action.executor.failed';
export const AUDIT_ACTION_EXECUTOR_TIMED_OUT = 'action.executor.timed_out';

const SENSITIVE_KEY_PATTERNS = [
  /^api[-_]?key$/i,
  /^secret/i,
  /^token$/i,
  /^access[-_]?token$/i,
  /^refresh[-_]?token$/i,
  /^password$/i,
  /^passwd$/i,
  /^private[-_]?key$/i,
  /^credentials$/i,
  /^authorization$/i,
  /^auth$/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function sanitizeMetadata(raw: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isSensitiveKey(key)) continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      safe[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      safe[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? sanitizeMetadata(item as Record<string, unknown>)
          : item,
      );
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

export interface RecordAuditEventParams {
  actorId: string;
  projectId: string;
  eventType: string;
  traceId: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditEvent(params: RecordAuditEventParams): Promise<void> {
  const db = getDb();
  const safeMetadata = params.metadata ? sanitizeMetadata(params.metadata) : {};

  await db.insert(auditEvents).values({
    actorId: params.actorId,
    projectId: params.projectId,
    eventType: params.eventType,
    traceId: params.traceId,
    targetType: params.targetType,
    targetId: params.targetId,
    metadata: safeMetadata,
  });
}

export async function getAuditEventsByProject(projectId: string, limit = 50, offset = 0) {
  const db = getDb();
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.projectId, projectId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getAllAuditEvents(limit = 50, offset = 0) {
  const db = getDb();
  return db
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit)
    .offset(offset);
}
