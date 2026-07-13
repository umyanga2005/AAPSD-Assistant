import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import Fastify, {
  type FastifyInstance,
  type FastifyError,
  type FastifyRequest,
  type FastifyReply,
} from 'fastify';
import { getConfig, ConfigError } from './config.js';
import { testConnection } from './db/index.js';
import { getAuditEventsByProject, recordAuditEvent } from './services/audit.js';
import { resolveDevUser, getProjectRole, hasRole, isRole } from './services/auth.js';
import type { Role, DevUser } from './services/auth.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : error.message,
      statusCode,
    });
  });

  const devAuthPreHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const devUserId = request.headers['x-dev-user-id'];
    const devRole = request.headers['x-dev-role'] as string | undefined;

    if (!devUserId || typeof devUserId !== 'string') {
      return reply.status(401).send({
        error: 'Unauthorized — provide X-Dev-User-Id header (temporary dev auth)',
        statusCode: 401,
      });
    }

    const roleOverride = devRole && isRole(devRole) ? devRole : undefined;

    try {
      const user = await resolveDevUser(devUserId, roleOverride);
      (request as unknown as Record<string, unknown>).user = user;
    } catch {
      return reply.status(401).send({
        error: 'Unauthorized — could not resolve user',
        statusCode: 401,
      });
    }
  };

  const requireProjectRole = (allowedRoles: Role[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as unknown as Record<string, unknown>).user as DevUser;
      const projectId = (request.query as Record<string, string | undefined>).project_id;

      if (!projectId) {
        return reply.status(400).send({
          error: 'Query parameter project_id is required',
          statusCode: 400,
        });
      }

      if (user.role === 'administrator') return;

      let projectRole: Role | null = null;
      try {
        projectRole = await getProjectRole(user.id, projectId);
      } catch {
        // fall through to 403
      }

      if (!projectRole || !hasRole(projectRole, allowedRoles[0])) {
        const traceId = crypto.randomUUID();
        recordAuditEvent({
          actorId: user.id,
          projectId,
          eventType: 'authorization.denied',
          traceId,
          targetType: 'endpoint',
          targetId: request.url,
          metadata: { reason: 'insufficient_role', userRole: user.role, projectRole, allowedRoles },
        }).catch(() => {});

        return reply.status(403).send({
          error: 'Forbidden — insufficient permissions for this project',
          statusCode: 403,
        });
      }
    };
  };

  app.get('/health', async () => {
    return {
      status: 'ok',
      service: '@aapsd/api',
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/ready', async () => {
    let database: 'up' | 'down' = 'down';
    try {
      database = (await testConnection()) ? 'up' : 'down';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptime: process.uptime(),
    };
  });

  app.get<{ Querystring: { project_id?: string } }>(
    '/api/audit-events',
    {
      preHandler: [
        devAuthPreHandler,
        requireProjectRole(['viewer', 'developer', 'approver', 'devops_engineer', 'administrator']),
      ],
    },
    async (request, reply) => {
      const { project_id } = request.query;
      if (!project_id) {
        return reply.status(400).send({
          error: 'Query parameter project_id is required',
          statusCode: 400,
        });
      }

      try {
        const events = await getAuditEventsByProject(project_id);
        return { data: events };
      } catch (err) {
        app.log.error(err);
        return reply.status(500).send({
          error: 'Internal Server Error',
          statusCode: 500,
        });
      }
    },
  );

  return app;
}

async function start(): Promise<void> {
  let config;
  try {
    config = getConfig();
  } catch (err: unknown) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const app = buildApp();

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`API listening on port ${config.port}`);
  } catch (err: unknown) {
    app.log.error(err);
    process.exit(1);
  }
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  start();
}
