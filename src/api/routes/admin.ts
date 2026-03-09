import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { query, transaction } from '../../database/db';

const JWT_SECRET = process.env.JWT_SECRET ?? 'collective-dev-secret';
const ADMIN_IDS = (process.env.ADMIN_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

interface JwtUser {
  discordId: string;
  username: string;
}

type AuthedRequest = FastifyRequest & { user?: JwtUser };

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = parseCookies(request.headers.cookie).collective_token;
  if (!token) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  try {
    const user = jwt.verify(token, JWT_SECRET) as JwtUser;
    (request as AuthedRequest).user = user;

    if (ADMIN_IDS.length === 0 || !ADMIN_IDS.includes(user.discordId)) {
      reply.code(403).send({ error: 'Admin access required' });
      return;
    }
  } catch {
    reply.code(401).send({ error: 'Invalid token' });
  }
}

async function ensureAdminTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS shop_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT ':item:',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  await query(
    `INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('house_edge', '2'), ('daily_reward', '500')`,
  );
}

function toPosInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  await ensureAdminTables();

  fastify.get('/api/admin/stats', { preHandler: requireAdmin }, async (_request, reply) => {
    const [activeUsers, totalWallets, circulation, bets24h] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM wallets WHERE last_active >= unixepoch() - 300'),
      query('SELECT COUNT(*) AS count FROM wallets'),
      query('SELECT COALESCE(SUM(balance), 0) AS total FROM wallets'),
      query('SELECT COUNT(*) AS count FROM bets WHERE created_at >= unixepoch() - 86400'),
    ]);

    reply.send({
      activeUsers: Number((activeUsers.rows[0] as { count: number } | undefined)?.count ?? 0),
      totalWallets: Number((totalWallets.rows[0] as { count: number } | undefined)?.count ?? 0),
      shardsInCirculation: Number((circulation.rows[0] as { total: number } | undefined)?.total ?? 0),
      bets24h: Number((bets24h.rows[0] as { count: number } | undefined)?.count ?? 0),
    });
  });

  fastify.get<{ Querystring: { page?: string; pageSize?: string; search?: string } }>(
    '/api/admin/users',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const page = toPosInt(request.query.page, 1);
      const pageSize = Math.min(toPosInt(request.query.pageSize, 20), 100);
      const offset = (page - 1) * pageSize;
      const search = String(request.query.search ?? '').trim().toLowerCase();
      const searchTerm = `%${search}%`;

      const whereSql = search ? 'WHERE LOWER(username) LIKE $1 OR discord_id LIKE $1' : '';
      const params = search ? [searchTerm] : [];

      const rowsSql = `
        SELECT wallet_id, discord_id, username, balance, is_banned, last_active
        FROM wallets
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const rowsRes = await query(rowsSql, [...params, pageSize, offset]);
      const countSql = `SELECT COUNT(*) AS count FROM wallets ${whereSql}`;
      const countRes = await query(countSql, params);

      reply.send({
        rows: rowsRes.rows,
        page,
        pageSize,
        total: Number((countRes.rows[0] as { count: number } | undefined)?.count ?? 0),
      });
    },
  );

  fastify.post<{ Params: { id: string } }>('/api/admin/users/:id/ban', { preHandler: requireAdmin }, async (request, reply) => {
    await query('UPDATE wallets SET is_banned = 1, updated_at = unixepoch() WHERE wallet_id = $1', [request.params.id]);
    reply.send({ ok: true });
  });

  fastify.post<{ Params: { id: string } }>('/api/admin/users/:id/unban', { preHandler: requireAdmin }, async (request, reply) => {
    await query('UPDATE wallets SET is_banned = 0, updated_at = unixepoch() WHERE wallet_id = $1', [request.params.id]);
    reply.send({ ok: true });
  });

  fastify.post<{ Params: { id: string }; Body: { amount?: number } }>(
    '/api/admin/users/:id/grant',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const amount = toPosInt(request.body?.amount, 0);
      if (amount < 1) {
        reply.code(400).send({ error: 'amount must be >= 1' });
        return;
      }

      const walletRes = await query('SELECT wallet_id, balance FROM wallets WHERE wallet_id = $1', [request.params.id]);
      const wallet = walletRes.rows[0] as { wallet_id: string; balance: number } | undefined;
      if (!wallet) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      const nextBalance = Number(wallet.balance) + amount;
      await transaction(async (client) => {
        await client.query('UPDATE wallets SET balance = $1, updated_at = unixepoch() WHERE wallet_id = $2', [
          nextBalance,
          wallet.wallet_id,
        ]);
        await client.query(
          'INSERT INTO transactions (wallet_id, type, amount, balance_before, balance_after, reference_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [
            wallet.wallet_id,
            'admin_grant',
            amount,
            wallet.balance,
            nextBalance,
            `admin_grant:${Date.now()}`,
            JSON.stringify({ reason: 'Admin grant' }),
          ],
        );
      });

      reply.send({ ok: true, balance: nextBalance, granted: amount });
    },
  );

  fastify.get<{ Querystring: { game?: string; user?: string; from?: string; to?: string } }>(
    '/api/admin/bets',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const params: unknown[] = [];
      const where: string[] = [];

      if (request.query.game) {
        where.push(`b.game = $${params.length + 1}`);
        params.push(String(request.query.game).toLowerCase());
      }

      if (request.query.user) {
        where.push(`LOWER(w.username) LIKE $${params.length + 1}`);
        params.push(`%${String(request.query.user).toLowerCase()}%`);
      }

      if (request.query.from) {
        where.push(`b.created_at >= $${params.length + 1}`);
        params.push(Math.floor(new Date(`${request.query.from}T00:00:00Z`).getTime() / 1000));
      }

      if (request.query.to) {
        where.push(`b.created_at <= $${params.length + 1}`);
        params.push(Math.floor(new Date(`${request.query.to}T23:59:59Z`).getTime() / 1000));
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const rows = await query(
        `
          SELECT b.id, b.game, b.bet_amount, b.payout, b.multiplier, b.created_at, w.username, w.discord_id
          FROM bets b
          JOIN wallets w ON w.wallet_id = b.wallet_id
          ${whereSql}
          ORDER BY b.id DESC
          LIMIT 200
        `,
        params,
      );

      reply.send({ rows: rows.rows });
    },
  );

  fastify.get('/api/admin/shop', { preHandler: requireAdmin }, async (_request, reply) => {
    const rows = await query(
      'SELECT id, name, price, description, emoji, enabled, created_at, updated_at FROM shop_items ORDER BY created_at DESC',
    );
    reply.send({ items: rows.rows });
  });

  fastify.post<{ Body: { name?: string; price?: number; description?: string; emoji?: string; enabled?: boolean } }>(
    '/api/admin/shop',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const name = String(request.body?.name ?? '').trim();
      const description = String(request.body?.description ?? '').trim();
      const emoji = String(request.body?.emoji ?? ':item:').trim() || ':item:';
      const price = toPosInt(request.body?.price, 0);
      const enabled = request.body?.enabled === false ? 0 : 1;

      if (!name || !description || price < 1) {
        reply.code(400).send({ error: 'name, description and price are required' });
        return;
      }

      const id = `item_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      await query(
        'INSERT INTO shop_items (id, name, price, description, emoji, enabled, updated_at) VALUES ($1,$2,$3,$4,$5,$6,unixepoch())',
        [id, name, price, description, emoji, enabled],
      );
      reply.send({ ok: true, id });
    },
  );

  fastify.put<{ Params: { id: string }; Body: { name?: string; price?: number; description?: string; emoji?: string; enabled?: boolean } }>(
    '/api/admin/shop/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const currentRes = await query('SELECT * FROM shop_items WHERE id = $1', [request.params.id]);
      const current =
        (currentRes.rows[0] as
          | { id: string; name: string; price: number; description: string; emoji: string; enabled: number }
          | undefined) ?? undefined;
      if (!current) {
        reply.code(404).send({ error: 'Item not found' });
        return;
      }

      const name = String(request.body?.name ?? current.name).trim();
      const description = String(request.body?.description ?? current.description).trim();
      const emoji = String(request.body?.emoji ?? current.emoji).trim() || ':item:';
      const price = toPosInt(request.body?.price ?? current.price, current.price);
      const enabled = request.body?.enabled === undefined ? current.enabled : request.body.enabled ? 1 : 0;

      await query(
        'UPDATE shop_items SET name = $1, price = $2, description = $3, emoji = $4, enabled = $5, updated_at = unixepoch() WHERE id = $6',
        [name, price, description, emoji, enabled, request.params.id],
      );

      reply.send({ ok: true });
    },
  );

  fastify.delete<{ Params: { id: string } }>('/api/admin/shop/:id', { preHandler: requireAdmin }, async (request, reply) => {
    await query('DELETE FROM shop_items WHERE id = $1', [request.params.id]);
    reply.send({ ok: true });
  });

  fastify.get('/api/admin/settings', { preHandler: requireAdmin }, async (_request, reply) => {
    const rows = await query('SELECT key, value FROM admin_settings');
    const settings = new Map<string, string>();
    for (const row of rows.rows as Array<{ key: string; value: string }>) {
      settings.set(row.key, row.value);
    }

    reply.send({
      houseEdge: Number(settings.get('house_edge') ?? '2'),
      dailyReward: Number(settings.get('daily_reward') ?? '500'),
    });
  });

  fastify.post<{ Body: { houseEdge?: number; dailyReward?: number } }>(
    '/api/admin/settings',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const houseEdge = Number.isFinite(request.body?.houseEdge) ? Number(request.body?.houseEdge) : 2;
      const dailyReward = Number.isFinite(request.body?.dailyReward) ? Number(request.body?.dailyReward) : 500;

      await query(
        `
          INSERT INTO admin_settings (key, value, updated_at)
          VALUES ('house_edge', $1, unixepoch()), ('daily_reward', $2, unixepoch())
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()
        `,
        [String(houseEdge), String(dailyReward)],
      );

      reply.send({ ok: true });
    },
  );
};
