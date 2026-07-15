import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    usersEmailIdx: index('idx_users_email').on(table.email),
    usersRoleIdx: index('idx_users_role').on(table.role),
  }),
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    projectsNameIdx: index('idx_projects_name').on(table.name),
  }),
);

export const environments = pgTable(
  'environments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    envProjectIdx: index('idx_environments_project_id').on(table.projectId),
    envNameProjectUniq: index('idx_environments_name_project').on(table.name, table.projectId),
  }),
);

export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 }).notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    pmProjectIdx: index('idx_pm_project_id').on(table.projectId),
    pmUserIdx: index('idx_pm_user_id').on(table.userId),
    pmUnique: uniqueIndex('idx_pm_project_user').on(table.projectId, table.userId),
  }),
);

export const requests = pgTable(
  'requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environment_id')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 100 }).notNull(),
    query: text('query').notNull(),
    status: varchar('status', { length: 30 }).notNull().default('pending'),
    traceId: varchar('trace_id', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    reqUserIdx: index('idx_requests_user_id').on(table.userId),
    reqProjectIdx: index('idx_requests_project_id').on(table.projectId),
    reqStatusIdx: index('idx_requests_status').on(table.status),
    reqTraceIdx: index('idx_requests_trace_id').on(table.traceId),
  }),
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    traceId: varchar('trace_id', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 100 }).notNull(),
    targetId: varchar('target_id', { length: 255 }).notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    auditActorIdx: index('idx_audit_actor_id').on(table.actorId),
    auditProjectIdx: index('idx_audit_project_id').on(table.projectId),
    auditEventTypeIdx: index('idx_audit_event_type').on(table.eventType),
    auditTraceIdx: index('idx_audit_trace_id').on(table.traceId),
    auditTargetIdx: index('idx_audit_target').on(table.targetType, table.targetId),
    auditCreatedIdx: index('idx_audit_created_at').on(table.createdAt),
  }),
);

export const userIntegrations = pgTable(
  'user_integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(),
    accessToken: text('access_token').notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    uiUserIdx: index('idx_user_integrations_user_id').on(table.userId),
    uiProviderIdx: index('idx_user_integrations_provider').on(table.provider),
    uiUnique: uniqueIndex('idx_user_integrations_user_provider').on(table.userId, table.provider),
  }),
);

export const oauthStates = pgTable(
  'oauth_states',
  {
    state: varchar('state', { length: 64 }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    osUserIdx: index('idx_oauth_states_user_id').on(table.userId),
  }),
);

export const diagnoses = pgTable(
  'diagnoses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    requestId: varchar('request_id', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    result: jsonb('result'),
    error: text('error'),
    traceId: varchar('trace_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    diagProjectIdx: index('idx_diag_project_id').on(table.projectId),
    diagRequestIdx: uniqueIndex('idx_diag_request_id').on(table.requestId),
    diagTraceIdx: index('idx_diag_trace_id').on(table.traceId),
  }),
);

export const actionPlans = pgTable(
  'action_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environment_id')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    actionType: varchar('action_type', { length: 100 }).notNull(),
    typedArgs: jsonb('typed_args').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    approverId: uuid('approver_id').references(() => users.id, { onDelete: 'set null' }),
    policyResult: jsonb('policy_result'),
    traceId: varchar('trace_id', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    apProjectIdx: index('idx_ap_project_id').on(table.projectId),
    apEnvIdx: index('idx_ap_environment_id').on(table.environmentId),
    apStatusIdx: index('idx_ap_status').on(table.status),
  }),
);

export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    description: text('description').notNull(),
    impactedComponent: varchar('impacted_component', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    incidentProjectIdx: index('idx_incidents_project_id').on(table.projectId),
    incidentStatusIdx: index('idx_incidents_status').on(table.status),
    incidentSeverityIdx: index('idx_incidents_severity').on(table.severity),
  }),
);

export const systemLogs = pgTable(
  'system_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    level: varchar('level', { length: 20 }).notNull(),
    message: text('message').notNull(),
    component: varchar('component', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sysLogLevelIdx: index('idx_system_logs_level').on(table.level),
    sysLogCreatedAtIdx: index('idx_system_logs_created_at').on(table.createdAt),
  }),
);

export const systemConnections = pgTable(
  'system_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: varchar('provider', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    details: text('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sysConnProviderIdx: index('idx_system_connections_provider').on(table.provider),
    sysConnCreatedAtIdx: index('idx_system_connections_created_at').on(table.createdAt),
  }),
);
