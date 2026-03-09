import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { query, transaction } from '../../database/db';
import { liveBus } from '../live';

const JWT_SECRET = process.env.JWT_SECRET ?? 'collective-dev-secret';

interface JwtUser {
  discordId: string;
  username: string;
}

type AuthedRequest = FastifyRequest & { user?: JwtUser };

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [k, ...rest] = part.trim().split('=');
    acc[k] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

async function requireJwt(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = parseCookies(request.headers.cookie).collective_token;
  if (!token) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  try {
    (request as AuthedRequest).user = jwt.verify(token, JWT_SECRET) as JwtUser;
  } catch {
    reply.code(401).send({ error: 'Invalid token' });
  }
}

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me', { preHandler: requireJwt }, async (request: AuthedRequest, reply) => {
    const row = await query('SELECT * FROM wallets WHERE discord_id = $1', [request.user?.discordId]);
    reply.send(row.rows[0] ?? null);
  });

  // PUBLIC endpoints (no auth)
  fastify.get('/api/leaderboard', async (_request, reply) => {
    const rows = await query('SELECT username, balance, games_played, biggest_win FROM wallets ORDER BY balance DESC LIMIT 20');
    reply.send(rows.rows);
  });

  fastify.get('/api/history', { preHandler: requireJwt }, async (request: AuthedRequest, reply) => {
    const wallet = await query('SELECT wallet_id FROM wallets WHERE discord_id = $1', [request.user?.discordId]);
    const walletId = (wallet.rows[0] as { wallet_id: string } | undefined)?.wallet_id;
    if (!walletId) {
      reply.send([]);
      return;
    }

    const history = await query('SELECT * FROM bets WHERE wallet_id = $1 ORDER BY id DESC LIMIT 50', [walletId]);
    reply.send(history.rows);
  });

  fastify.get('/api/feed', async (_request, reply) => {
    const feed = await query('SELECT game, bet_amount, payout, created_at FROM bets ORDER BY id DESC LIMIT 20');
    reply.send(
      (feed.rows as Array<{ game: string; bet_amount: number; payout: number; created_at: number }>).map((r) => ({
        game: r.game,
        bet: Math.round(Number(r.bet_amount) / 10) * 10,
        payout: Math.round(Number(r.payout) / 10) * 10,
        created_at: r.created_at,
      })),
    );
  });

  fastify.get('/api/stats', async (_request, reply) => {
    const [wallets, circulating, active, games] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM wallets'),
      query('SELECT COALESCE(SUM(balance),0) AS total FROM wallets'),
      query('SELECT COUNT(*) AS count FROM wallets WHERE last_active >= unixepoch() - 86400'),
      query('SELECT COUNT(*) AS count FROM bets WHERE created_at >= unixepoch() - 86400'),
    ]);

    reply.send({
      wallets: Number((wallets.rows[0] as { count: number }).count),
      circulating: Number((circulating.rows[0] as { total: number }).total),
      activeToday: Number((active.rows[0] as { count: number }).count),
      gamesToday: Number((games.rows[0] as { count: number }).count),
    });
  });

  fastify.post('/api/daily', { preHandler: requireJwt }, async (request: AuthedRequest, reply) => {
    const walletRes = await query('SELECT * FROM wallets WHERE discord_id = $1', [request.user?.discordId]);
    const wallet = walletRes.rows[0] as { wallet_id: string; balance: number } | undefined;
    if (!wallet) {
      reply.code(404).send({ error: 'Wallet not found' });
      return;
    }

    const claim = await query('SELECT claimed_at FROM daily_claims WHERE wallet_id = $1', [wallet.wallet_id]);
    const now = Math.floor(Date.now() / 1000);
    const lastClaim = Number((claim.rows[0] as { claimed_at: number } | undefined)?.claimed_at ?? 0);
    if (now - lastClaim < 86400) {
      reply.code(429).send({ error: 'Cooldown active', secondsRemaining: 86400 - (now - lastClaim) });
      return;
    }

    let newBalance = wallet.balance;
    await transaction(async (client) => {
      await client.query('UPDATE wallets SET balance = balance + 500 WHERE wallet_id = $1', [wallet.wallet_id]);
      await client.query(
        'INSERT INTO daily_claims (wallet_id, claimed_at) VALUES ($1, $2) ON CONFLICT(wallet_id) DO UPDATE SET claimed_at = excluded.claimed_at',
        [wallet.wallet_id, now],
      );
      const latest = await client.query('SELECT balance FROM wallets WHERE wallet_id = $1', [wallet.wallet_id]);
      newBalance = Number((latest.rows[0] as { balance: number }).balance);
    });

    liveBus.emitEvent('balance_update', { walletId: wallet.wallet_id, after: newBalance, reason: 'daily' });
    reply.send({ ok: true, reward: 500, balance: newBalance });
  });
};
