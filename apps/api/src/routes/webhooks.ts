import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { getConfigSafe } from '../config.js';

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/github', async (request, reply) => {
    const config = getConfigSafe();
    const secret = 'webhookSecret' in config ? config.webhookSecret : undefined;

    if (!secret) {
      app.log.warn('Webhook secret is not configured. Rejecting webhook.');
      return reply.status(500).send({ error: 'Webhook secret not configured' });
    }

    const signature = request.headers['x-hub-signature-256'] as string;
    if (!signature) {
      return reply.status(401).send({ error: 'Missing signature' });
    }

    // Usually body is a parsed object, but we need the raw payload for correct HMAC.
    // In Fastify, to get the raw body without breaking JSON parsing, we usually use raw-body
    // plugin, but for simplicity here we stringify. Note: this may fail if whitespace differs.
    // A robust implementation would store raw body on the request object.
    const rawBody =
      (request.raw as unknown as { rawBody?: string }).rawBody || JSON.stringify(request.body);

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(rawBody).digest('hex');

    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest)) === false) {
      app.log.warn('Invalid webhook signature');
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // Process webhook
    return reply.status(200).send({ status: 'ok' });
  });
};
