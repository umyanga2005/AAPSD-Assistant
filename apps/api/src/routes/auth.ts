import { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { userIntegrations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

import { FastifyRequest, FastifyReply } from 'fastify';

export default async function authRoutes(
  app: FastifyInstance,
  opts: { devAuthPreHandler: (request: FastifyRequest, reply: FastifyReply) => Promise<void> },
) {
  app.get('/api/auth/github', async (request, reply) => {
    // We need to pass the user ID as state so we know who to attach the token to.
    // However, OAuth state usually requires session handling or JWTs.
    // For simplicity, we can pass a dummy state or require the client to pass their Firebase token as a query param.
    // Better yet: Since redirecting leaves the SPA, the user will come back to a generic page.

    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return reply.status(500).send({ error: 'GitHub Client ID not configured' });
    }

    // In a real app, state should be a cryptographically secure random string linked to the user's session
    const redirectUri = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo,read:org&state=redirecting`;
    return reply.redirect(redirectUri);
  });

  app.get('/api/auth/github/callback', async (request, reply) => {
    const { code, state: _state } = request.query as { code?: string; state?: string };

    if (!code) {
      return reply.status(400).send({ error: 'Missing code parameter' });
    }

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
        return reply.status(400).send({ error: tokenData.error_description || tokenData.error });
      }

      const accessToken = tokenData.access_token;

      // Send the token back to the main window
      const html = `
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'GITHUB_OAUTH_SUCCESS', token: '${accessToken}' }, '*');
              window.close();
            </script>
            <p>Authentication successful! You can close this window.</p>
          </body>
        </html>
      `;
      reply.type('text/html').send(html);
    } catch (err) {
      console.error('GitHub OAuth Error:', err);
      return reply.status(500).send({ error: 'Internal Server Error during GitHub OAuth' });
    }
  });

  // New endpoint to securely save the token sent by the frontend
  app.post(
    '/api/auth/github/save',
    { preHandler: [opts.devAuthPreHandler] },
    async (request, reply) => {
      const { token } = request.body as { token: string };
      const user = (request as unknown as Record<string, unknown>).user as { id: string };

      if (!token) return reply.status(400).send({ error: 'Token is required' });

      const db = getDb();

      // Check if integration exists
      const existing = await db
        .select()
        .from(userIntegrations)
        .where(and(eq(userIntegrations.userId, user.id), eq(userIntegrations.provider, 'github')))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(userIntegrations)
          .set({ accessToken: token, updatedAt: new Date() })
          .where(eq(userIntegrations.id, existing[0].id));
      } else {
        await db.insert(userIntegrations).values({
          userId: user.id,
          provider: 'github',
          accessToken: token,
        });
      }

      return { success: true };
    },
  );

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
