import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import Fastify, {
  type FastifyInstance,
  type FastifyError,
  type FastifyRequest,
  type FastifyReply,
} from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
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
  setGitHubAdapter,
  getGitHubAdapter,
  RealK8sAdapter,
  setK8sAdapter,
  getK8sAdapter,
  RealPrometheusAdapter,
  setPrometheusAdapter,
  getPrometheusAdapter,
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

export async function buildApp(): Promise<FastifyInstance> {
  const modelProvider = createModelProvider();
  const config = getConfigSafe();
  if ('_errors' in config) {
    console.warn('Config errors, proceeding with default real adapters:', config._errors);
  }

  // Always use real adapters, providing dummy config if missing to prevent startup crash
  // Actual API calls will fail gracefully in the route handlers
  const ghAdapter = new RealGitHubAdapter({
    token: ('gitHubToken' in config ? config.gitHubToken : '') || 'dummy_token',
    allowedRepos: 'gitHubAllowedRepos' in config ? config.gitHubAllowedRepos : [],
  });
  setGitHubAdapter(ghAdapter);

  const k8sAdapter = new RealK8sAdapter({
    token: ('k8sToken' in config ? config.k8sToken : '') || 'dummy_token',
    apiServerUrl: ('k8sApiServerUrl' in config ? config.k8sApiServerUrl : '') || 'http://localhost',
    allowedNamespaces: 'k8sAllowedNamespaces' in config ? config.k8sAllowedNamespaces : [],
  });
  setK8sAdapter(k8sAdapter);

  const promAdapter = new RealPrometheusAdapter({
    baseUrl: ('prometheusBaseUrl' in config ? config.prometheusBaseUrl : '') || 'http://localhost',
    allowedMetrics:
      'prometheusAllowedMetrics' in config && config.prometheusAllowedMetrics.length > 0
        ? config.prometheusAllowedMetrics
        : ALL_METRICS,
  });
  setPrometheusAdapter(promAdapter);

  const app = Fastify({
    logger: true,
  });

  await app.register(fastifyCors, {
    origin: '*', // Allow all origins for dev/dashboard, or configure properly
  });

  await app.register(fastifyWebsocket);

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

  app.get('/api/pipelines', async () => {
    const gh = getGitHubAdapter();
    if (!gh) return { data: [] };
    try {
      const config = getConfigSafe();
      const repo =
        !('_errors' in config) && config.gitHubAllowedRepos[0]
          ? config.gitHubAllowedRepos[0]
          : 'umyanga2005/AAPSD-Assistant';
      const runs = await gh.getWorkflowRuns(repo, 10);
      return { data: runs };
    } catch {
      return { data: [] }; // Fallback to empty if it fails (as requested)
    }
  });

  app.get('/api/infrastructure', async () => {
    const k8s = getK8sAdapter();
    if (!k8s) return { deployments: [], pods: [] };
    try {
      const [deployments, pods] = await Promise.all([
        k8s.getDeployments('default'),
        k8s.getPods('default'),
      ]);
      return { deployments, pods };
    } catch {
      return { deployments: [], pods: [] }; // Fallback to empty if it fails
    }
  });

  app.route({
    method: 'GET',
    url: '/api/ws/dashboard',
    handler: (req, reply) => {
      reply.status(400).send({ error: 'WebSocket connection required' });
    },
    wsHandler: (connection, _req) => {
      const sendUpdates = async () => {
        try {
          const gh = getGitHubAdapter();
          const k8s = getK8sAdapter();
          const prom = getPrometheusAdapter();

          const pipelines: { data: unknown[] } = { data: [] };
          if (gh) {
            const repo =
              !('_errors' in config) && config.gitHubAllowedRepos[0]
                ? config.gitHubAllowedRepos[0]
                : 'umyanga2005/AAPSD-Assistant';
            pipelines.data = await gh.getWorkflowRuns(repo, 10).catch(() => []);
          }

          let infrastructure: { deployments: unknown[]; pods: unknown[] } = {
            deployments: [],
            pods: [],
          };
          if (k8s) {
            const [deployments, pods] = await Promise.all([
              k8s.getDeployments('default').catch(() => []),
              k8s.getPods('default').catch(() => []),
            ]);
            infrastructure = { deployments, pods };
          }

          let metrics: { cpu: unknown; memory: unknown } = { cpu: null, memory: null };
          if (prom) {
            const [cpu, memory] = await Promise.all([
              prom.query('cpu').catch(() => null),
              prom.query('memory').catch(() => null),
            ]);
            metrics = { cpu, memory };
          }

          connection.send(
            JSON.stringify({ type: 'update', payload: { pipelines, infrastructure, metrics } }),
          );
        } catch (err) {
          app.log.error(err);
        }
      };

      // Send initial update immediately
      sendUpdates();
      // Poll every 5 seconds
      const timer = setInterval(sendUpdates, 5000);

      connection.on('close', () => {
        clearInterval(timer);
      });
    },
  });

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

  const app = await buildApp();

  console.log('\n--- System Environment Checks ---');

  // Database Check
  try {
    await testConnection();
    console.log('✅ Database: Connected successfully');
  } catch (err) {
    console.log(
      `❌ Database: Failed to connect - ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // GitHub Check
  const gh = getGitHubAdapter();
  if (gh) {
    try {
      const repo =
        !('_errors' in config) && config.gitHubAllowedRepos[0]
          ? config.gitHubAllowedRepos[0]
          : 'umyanga2005/AAPSD-Assistant';
      await gh.getWorkflowRuns(repo, 1);
      console.log('✅ GitHub Adapter: Connected successfully');
    } catch (err) {
      console.log(
        `❌ GitHub Adapter: Failed to connect - ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Kubernetes Check
  const k8s = getK8sAdapter();
  if (k8s) {
    try {
      await k8s.getPods('default');
      console.log('✅ Kubernetes Adapter: Connected successfully');
    } catch (err) {
      console.log(
        `❌ Kubernetes Adapter: Failed to connect - ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Prometheus Check
  const prom = getPrometheusAdapter();
  if (prom) {
    try {
      await prom.query('cpu');
      console.log('✅ Prometheus Adapter: Connected successfully');
    } catch (err) {
      console.log(
        `❌ Prometheus Adapter: Failed to connect - ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log('--- Environment Checks Complete ---\n');
  console.log('Connected and can continue other logs inside terminal\n');

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
