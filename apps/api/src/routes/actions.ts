import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { actionPlans, environments, projectMembers } from '../db/schema.js';
import { getConfigSafe } from '../config.js';
import { PolicyEvaluator, PolicyContext } from '@aapsd/policy';
import {
  AUDIT_ACTION_PLAN_CREATED,
  AUDIT_ACTION_PLAN_DENIED,
  AUDIT_ACTION_PLAN_APPROVED,
  AUDIT_ACTION_PLAN_REJECTED,
  recordAuditEvent,
} from '../services/audit.js';

export const actionRoutes: FastifyPluginAsync = async (app) => {
  const configResult = getConfigSafe();
  const config =
    'gitHubAllowedRepos' in configResult
      ? configResult
      : {
          gitHubAllowedRepos: [],
          k8sAllowedNamespaces: [],
          actionAllowedDeployments: [],
          actionMinScale: 1,
          actionMaxScale: 5,
        };

  const evaluator = new PolicyEvaluator({
    allowedRepos: config.gitHubAllowedRepos,
    allowedWorkflows: [], // Extendable via config later
    allowedNamespaces: config.k8sAllowedNamespaces,
    allowedDeployments: config.actionAllowedDeployments,
    minScale: config.actionMinScale,
    maxScale: config.actionMaxScale,
  });

  // POST /api/action-plans
  app.post<{
    Body: {
      projectId: string;
      environmentId: string;
      actionType: string;
      typedArgs: unknown;
    };
  }>(
    '/action-plans',
    {
      schema: {
        body: Type.Object({
          projectId: Type.String({ format: 'uuid' }),
          environmentId: Type.String({ format: 'uuid' }),
          actionType: Type.String(),
          typedArgs: Type.Unknown(),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as unknown as Record<string, unknown>).user as
        { id: string; role: string } | undefined;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { projectId, environmentId, actionType, typedArgs } = request.body;
      const db = getDb();

      // Get user role in project
      const member = await db
        .select()
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
        .limit(1);

      let userRole = 'viewer';
      if (user.role === 'administrator') {
        userRole = 'administrator';
      } else if (member.length > 0) {
        userRole = member[0].role;
      }

      // Get environment to check name
      const env = await db
        .select()
        .from(environments)
        .where(eq(environments.id, environmentId))
        .limit(1);

      if (env.length === 0) {
        return reply.status(404).send({ error: 'Environment not found' });
      }

      const context: PolicyContext = {
        environmentName: env[0].name,
        userRole,
        actionType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: typedArgs as any,
      };

      const result = evaluator.evaluate(context);

      const traceId = request.id;

      if (!result.allowed) {
        await recordAuditEvent({
          actorId: user.id,
          projectId,
          eventType: AUDIT_ACTION_PLAN_DENIED,
          traceId,
          targetType: 'actionPlan',
          targetId: 'new',
          metadata: { actionType, reason: result.reason, typedArgs },
        });

        return reply.status(403).send({ error: 'Policy Denied', reason: result.reason });
      }

      const plan = await db
        .insert(actionPlans)
        .values({
          projectId,
          environmentId,
          actionType,
          typedArgs,
          status: 'pending',
          actorId: user.id,
          policyResult: result as unknown as Record<string, unknown>,
          traceId,
        })
        .returning();

      await recordAuditEvent({
        actorId: user.id,
        projectId,
        eventType: AUDIT_ACTION_PLAN_CREATED,
        traceId,
        targetType: 'actionPlan',
        targetId: plan[0].id,
        metadata: { actionType },
      });

      return reply.status(201).send(plan[0]);
    },
  );

  // GET /api/action-plans
  app.get<{
    Querystring: { projectId: string };
  }>(
    '/action-plans',
    {
      schema: {
        querystring: Type.Object({
          projectId: Type.String({ format: 'uuid' }),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as unknown as Record<string, unknown>).user as
        { id: string; role: string } | undefined;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { projectId } = request.query;
      const db = getDb();

      const plans = await db.select().from(actionPlans).where(eq(actionPlans.projectId, projectId));

      return reply.status(200).send(plans);
    },
  );

  // POST /api/action-plans/:id/approve
  app.post<{
    Params: { id: string };
  }>(
    '/action-plans/:id/approve',
    {
      schema: {
        params: Type.Object({
          id: Type.String({ format: 'uuid' }),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as unknown as Record<string, unknown>).user as
        { id: string; role: string } | undefined;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = getDb();
      const plan = await db
        .select()
        .from(actionPlans)
        .where(eq(actionPlans.id, request.params.id))
        .limit(1);

      if (plan.length === 0) {
        return reply.status(404).send({ error: 'Plan not found' });
      }

      const member = await db
        .select()
        .from(projectMembers)
        .where(
          and(eq(projectMembers.projectId, plan[0].projectId), eq(projectMembers.userId, user.id)),
        )
        .limit(1);

      let userRole = 'viewer';
      if (user.role === 'administrator') {
        userRole = 'administrator';
      } else if (member.length > 0) {
        userRole = member[0].role;
      }

      const ROLE_HIERARCHY: Record<string, number> = {
        viewer: 1,
        developer: 2,
        approver: 3,
        devops_engineer: 4,
        administrator: 5,
      };

      const roleLevel = ROLE_HIERARCHY[userRole] || 0;
      if (roleLevel < ROLE_HIERARCHY['approver']) {
        return reply.status(403).send({ error: 'Insufficient role to approve actions' });
      }

      if (plan[0].status !== 'pending') {
        return reply.status(400).send({ error: 'Plan is not in pending state' });
      }

      const updated = await db
        .update(actionPlans)
        .set({ status: 'approved', approverId: user.id })
        .where(eq(actionPlans.id, request.params.id))
        .returning();

      await recordAuditEvent({
        actorId: user.id,
        projectId: plan[0].projectId,
        eventType: AUDIT_ACTION_PLAN_APPROVED,
        traceId: request.id,
        targetType: 'actionPlan',
        targetId: plan[0].id,
      });

      return reply.status(200).send(updated[0]);
    },
  );

  // POST /api/action-plans/:id/reject
  app.post<{
    Params: { id: string };
  }>(
    '/action-plans/:id/reject',
    {
      schema: {
        params: Type.Object({
          id: Type.String({ format: 'uuid' }),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as unknown as Record<string, unknown>).user as
        { id: string; role: string } | undefined;
      if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const db = getDb();
      const plan = await db
        .select()
        .from(actionPlans)
        .where(eq(actionPlans.id, request.params.id))
        .limit(1);

      if (plan.length === 0) {
        return reply.status(404).send({ error: 'Plan not found' });
      }

      if (plan[0].status !== 'pending') {
        return reply.status(400).send({ error: 'Plan is not in pending state' });
      }

      // Any valid project member can reject? Or we restrict to approver as well.
      // Usually anyone with 'developer' or higher can reject, or the actor themselves.
      const updated = await db
        .update(actionPlans)
        .set({ status: 'rejected', approverId: user.id })
        .where(eq(actionPlans.id, request.params.id))
        .returning();

      await recordAuditEvent({
        actorId: user.id,
        projectId: plan[0].projectId,
        eventType: AUDIT_ACTION_PLAN_REJECTED,
        traceId: request.id,
        targetType: 'actionPlan',
        targetId: plan[0].id,
      });

      return reply.status(200).send(updated[0]);
    },
  );
};
