import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../db/index.js';
import { userIntegrations, oauthStates } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { encrypt } from '../services/encryption.js';

export default async function authRoutes(
  app: FastifyInstance,
  opts: { devAuthPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void> },
) {
  // 1. Authenticated endpoint to generate OAuth URL and state
  app.get(
    '/api/auth/github/url',
    { preHandler: [opts.devAuthPreHandler] },
    async (request, reply) => {
      const user = (request as unknown as Record<string, unknown>).user as { id: string };

      const clientId = process.env.GITHUB_CLIENT_ID;
      if (!clientId) {
        return reply.status(500).send({ error: 'GitHub Client ID not configured' });
      }

      // Generate secure state
      const state = crypto.randomBytes(32).toString('hex');
      const db = getDb();

      // Store state linked to user
      await db.insert(oauthStates).values({
        state,
        userId: user.id,
        provider: 'github',
      });

      // We only need the 'repo' scope for pipelines (actions), or 'repo:status' depending on exact needs,
      // but 'repo' is standard for GitHub apps managing CI/CD.
      const redirectUri = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&state=${state}`;
      return { url: redirectUri };
    },
  );

  // 2. Callback from GitHub
  app.get('/api/auth/github/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    const targetOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

    if (!code || !state) {
      return reply.type('text/html').send(`
        <script>
          window.opener.postMessage({ type: 'GITHUB_OAUTH_ERROR', error: 'Missing code or state' }, '${targetOrigin}');
          window.close();
        </script>
      `);
    }

    const db = getDb();

    // Validate state
    const stateRecord = await db
      .select()
      .from(oauthStates)
      .where(eq(oauthStates.state, state))
      .limit(1);

    if (stateRecord.length === 0) {
      return reply.type('text/html').send(`
        <script>
          window.opener.postMessage({ type: 'GITHUB_OAUTH_ERROR', error: 'Invalid or expired state' }, '${targetOrigin}');
          window.close();
        </script>
      `);
    }

    const { userId } = stateRecord[0];

    // Delete state so it can't be replayed
    await db.delete(oauthStates).where(eq(oauthStates.state, state));

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return reply.status(500).send({ error: 'GitHub OAuth not configured properly' });
    }

    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return reply.type('text/html').send(`
          <script>
            window.opener.postMessage({ type: 'GITHUB_OAUTH_ERROR', error: '${tokenData.error_description || tokenData.error}' }, '${targetOrigin}');
            window.close();
          </script>
        `);
      }

      const accessToken = tokenData.access_token;

      // Encrypt the token at rest
      const encryptedToken = encrypt(accessToken);

      // Save to user_integrations directly
      const existing = await db
        .select()
        .from(userIntegrations)
        .where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, 'github')))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(userIntegrations)
          .set({ accessToken: encryptedToken, updatedAt: new Date() })
          .where(eq(userIntegrations.id, existing[0].id));
      } else {
        await db.insert(userIntegrations).values({
          userId,
          provider: 'github',
          accessToken: encryptedToken,
        });
      }

      // Send success message to the frontend (without the token)
      const html = `
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'GITHUB_OAUTH_SUCCESS' }, '${targetOrigin}');
              window.close();
            </script>
            <p>Authentication successful! You can close this window.</p>
          </body>
        </html>
      `;
      reply.type('text/html').send(html);
    } catch (err) {
      console.error('GitHub OAuth Error:', err);
      return reply.type('text/html').send(`
        <script>
          window.opener.postMessage({ type: 'GITHUB_OAUTH_ERROR', error: 'Internal Server Error during GitHub OAuth' }, '${targetOrigin}');
          window.close();
        </script>
      `);
    }
  });

  // Get user integrations
  app.get('/api/integrations', { preHandler: [opts.devAuthPreHandler] }, async (request, reply) => {
    const user = (request as unknown as Record<string, unknown>).user as { id: string };
    const db = getDb();

    try {
      const integrations = await db
        .select({
          provider: userIntegrations.provider,
          updatedAt: userIntegrations.updatedAt,
        })
        .from(userIntegrations)
        .where(eq(userIntegrations.userId, user.id));

      return { data: integrations };
    } catch (err) {
      console.error('Failed to fetch integrations', err);
      return reply.status(500).send({ error: 'Failed to fetch integrations' });
    }
  });
}
