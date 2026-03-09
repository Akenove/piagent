import crypto from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import jwt from 'jsonwebtoken';
import { ensureWalletForUser } from '../../utils/economy';

const DISCORD_OAUTH = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN = 'https://discord.com/api/oauth2/token';
const DISCORD_ME = 'https://discord.com/api/users/@me';

const CLIENT_ID = process.env.CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? '';
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI ?? 'http://localhost:3001/auth/callback';
const JWT_SECRET = process.env.JWT_SECRET ?? 'collective-dev-secret';

function cookieState(): string {
  return crypto.randomBytes(16).toString('hex');
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [k, ...rest] = part.trim().split('=');
    acc[k] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function serializeCookie(name: string, value: string, options: { maxAge?: number; httpOnly?: boolean; sameSite?: 'Lax' | 'Strict' | 'None'; secure?: boolean } = {}): string {
  const segments = [`${name}=${encodeURIComponent(value)}`, 'Path=/'];
  if (options.maxAge !== undefined) segments.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  if (options.httpOnly) segments.push('HttpOnly');
  if (options.sameSite) segments.push(`SameSite=${options.sameSite}`);
  if (options.secure) segments.push('Secure');
  return segments.join('; ');
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/auth/discord', async (_request, reply) => {
    const state = cookieState();
    reply.header('Set-Cookie', serializeCookie('collective_oauth_state', state, { httpOnly: true, sameSite: 'Lax' }));

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'identify',
      state,
      prompt: 'none',
    });

    reply.redirect(`${DISCORD_OAUTH}?${params.toString()}`);
  });

  fastify.get('/auth/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    if (!code || !state) {
      reply.code(400).send('Invalid callback parameters.');
      return;
    }

    const cookieStateValue = parseCookies(request.headers.cookie).collective_oauth_state;
    if (!cookieStateValue || cookieStateValue !== state) {
      reply.code(403).send('State mismatch.');
      return;
    }

    try {
      const tokenRes = await fetch(DISCORD_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        throw new Error(`Token exchange failed: ${body}`);
      }

      const tokenJson = (await tokenRes.json()) as { access_token: string };
      const userRes = await fetch(DISCORD_ME, {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });

      if (!userRes.ok) {
        const body = await userRes.text();
        throw new Error(`User fetch failed: ${body}`);
      }

      const user = (await userRes.json()) as { id: string; username: string };
      await ensureWalletForUser({ id: user.id, username: user.username } as any);

      const token = jwt.sign({ discordId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      reply.header('Set-Cookie', [
        serializeCookie('collective_oauth_state', '', { maxAge: 0, httpOnly: true, sameSite: 'Lax' }),
        serializeCookie('collective_token', token, {
          httpOnly: true,
          sameSite: 'Lax',
          secure: false,
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      ]);
      reply.redirect('/dashboard.html');
    } catch (error: any) {
      reply.code(500).send(error.message ?? 'Auth failed');
    }
  });

  fastify.get('/auth/logout', async (_request, reply) => {
    reply.header('Set-Cookie', serializeCookie('collective_token', '', { maxAge: 0, httpOnly: true, sameSite: 'Lax' }));
    reply.redirect('/');
  });
};
