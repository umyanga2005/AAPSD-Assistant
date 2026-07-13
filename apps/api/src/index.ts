import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import Fastify, {
  type FastifyInstance,
  type FastifyError,
  type FastifyRequest,
  type FastifyReply,
} from 'fastify';
import { getConfig, getConfigSafe, ConfigError } from './config.js';
import { getDb } from './db/index.js';
import { requests } from './db/schema.js';
import { testConnection } from './db/index.js';
import { getAuditEventsByProject, recordAuditEvent } from './services/audit.js';
import { resolveDevUser, getProjectRole, hasRole, isRole } from './services/auth.js';
import { validateDiagnoseBody } from './services/validation.js';
import {
  runDiagnosis,
  FakeModelProvider,
  OpenRouterModelProvider,
  RealGitHubAdapter,
  MockGitHubAdapter,
  setGitHubAdapter,
  RealK8sAdapter,
  MockK8sAdapter,
  setK8sAdapter,
  RealPrometheusAdapter,
  MockPrometheusAdapter,
  setPrometheusAdapter,
  ALL_METRICS,
  type ModelProvider,
} from '@aapsd/diagnosis';
import type { Role, DevUser } from './services/auth.js';

function createModelProvider(): ModelProvider {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey) {
    return new OpenRouterModelProvider({ apiKey });
  }
  return new FakeModelProvider();
}

export function buildApp(): FastifyInstance {
  const modelProvider = createModelProvider();
  const config = getConfigSafe();
  if ('_errors' in config) {
    console.warn('Config errors, skipping adapter setup:', config._errors);
  } else {
    if (config.gitHubToken) {
      const ghAdapter = new RealGitHubAdapter({
        token: config.gitHubToken,
        allowedRepos: config.gitHubAllowedRepos,
      });
      setGitHubAdapter(ghAdapter);
    } else {
      setGitHubAdapter(new MockGitHubAdapter());
    }

    if (config.k8sToken) {
      const k8sAdapter = new RealK8sAdapter({
        token: config.k8sToken,
        apiServerUrl: config.k8sApiServerUrl,
        allowedNamespaces: config.k8sAllowedNamespaces,
      });
      setK8sAdapter(k8sAdapter);
    } else {
      setK8sAdapter(new MockK8sAdapter());
    }

    if (config.prometheusBaseUrl) {
      const promAdapter = new RealPrometheusAdapter({
        baseUrl: config.prometheusBaseUrl,
        allowedMetrics:
          config.prometheusAllowedMetrics.length > 0
            ? config.prometheusAllowedMetrics
            : ALL_METRICS,
      });
      setPrometheusAdapter(promAdapter);
    } else {
      setPrometheusAdapter(new MockPrometheusAdapter());
    }
  }

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

  app.post('/api/v1/diagnoses', { preHandler: [devAuthPreHandler] }, async (request, reply) => {
    const user = (request as unknown as Record<string, unknown>).user as DevUser;
    const validation = validateDiagnoseBody(request.body);

    if (!validation.valid) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validation.errors.map((e) => `${e.field}: ${e.message}`),
        statusCode: 400,
      });
    }

    const { projectId, environmentId, query, context } = validation.data;
    const traceId = crypto.randomUUID();
    const requestId = crypto.randomUUID();

    try {
      await getDb().insert(requests).values({
        id: requestId,
        userId: user.id,
        projectId,
        environmentId,
        action: 'diagnose',
        query,
        status: 'completed',
        traceId,
      });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        statusCode: 500,
      });
    }

    const diagnosisRequest = {
      userId: user.id,
      projectId,
      environmentId,
      query,
      traceId,
      context,
    };

    let result;
    try {
      result = await runDiagnosis(diagnosisRequest, [user.role], modelProvider);
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        statusCode: 500,
      });
    }

    recordAuditEvent({
      actorId: user.id,
      projectId,
      eventType: 'request.created',
      traceId,
      targetType: 'diagnosis',
      targetId: requestId,
      metadata: { query },
    }).catch(() => {});

    return reply.status(200).send(result);
  });

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
