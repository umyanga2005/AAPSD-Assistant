import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import { getConfig } from './config.js';

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

  app.get('/health', async () => {
    return {
      status: 'ok',
      service: '@aapsd/api',
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/ready', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  });

  return app;
}

async function start(): Promise<void> {
  const config = getConfig();
  const app = buildApp();

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`API listening on port ${config.port}`);
  } catch (err: unknown) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
