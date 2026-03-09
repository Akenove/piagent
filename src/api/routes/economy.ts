import crypto from 'crypto';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { query, transaction } from '../../database/db';
import { crashPoint, diceRoll, getResultHex, rouletteNumber, slotReels } from '../../games/provably-fair';
import { adjustBalance, getActiveSeed, getWalletByDiscordId } from '../../utils/economy';

const JWT_SECRET = process.env.JWT_SECRET ?? 'collective-dev-secret';
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

interface JwtUser {
  discordId: string;
  username: string;
}

type AuthedRequest = FastifyRequest & { user?: JwtUser };

interface Stonk {
  ticker: string;
  name: string;
  price: number;
  change: number;
  emoji: string;
}

const ITEMS: Record<string, { name: string; price: number; desc: string; emoji: string }> = {
  title_degen: { name: 'Degen Lord Title', price: 2500, emoji: '🎭', desc: 'Custom title shown in /profile' },
  vip_7d: { name: 'VIP Role 7d', price: 5000, emoji: '⚡', desc: 'VIP Discord role for 7 days' },
  bonus_daily: { name: '2x Daily Bonus', price: 1000, emoji: '💎', desc: 'Double your /daily for 24h' },
  loss_protect: { name: 'Loss Protection', price: 3000, emoji: '🛡️', desc: 'Refund 50% on next loss' },
  shoutout: { name: 'Spotlight', price: 10000, emoji: '🎪', desc: 'Pi OS shouts you out in #general' },
};

const BASE_STONKS: Omit<Stonk, 'change'>[] = [
  { ticker: 'BTC', name: 'Bitcoin', price: 500, emoji: '₿' },
  { ticker: 'SOL', name: 'Solana', price: 200, emoji: '◎' },
  { ticker: 'PEPE', name: 'Pepe Coin', price: 50, emoji: '🐸' },
  { ticker: 'DOGE', name: 'Dogecoin', price: 30, emoji: '🐶' },
  { ticker: 'PI', name: 'Pi OS', price: 1000, emoji: '🥧' },
  { ticker: 'REKT', name: 'Rekt Index', price: 5, emoji: '💀' },
];

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

function mineAmount(balance: number, serverSeed: string, clientSeed: string): number {
  const tier = balance >= 50000 ? [200, 199] : balance >= 10000 ? [100, 99] : balance >= 1000 ? [50, 49] : [20, 29];
  const [base, spread] = tier;
  const hmac = crypto.createHmac('sha256', serverSeed).update(`${clientSeed}:mine`).digest();
  const roll = hmac.readUInt16BE(0) / 65536;
  return base + Math.floor(roll * (spread + 1));
}

async function walletForRequest(request: AuthedRequest) {
  const discordId = request.user?.discordId;
  if (!discordId) return null;
  return getWalletByDiscordId(discordId);
}

async function initStonks(): Promise<void> {
  for (const s of BASE_STONKS) {
    await query('INSERT OR IGNORE INTO stonks (ticker, name, price, emoji) VALUES ($1,$2,$3,$4)', [s.ticker, s.name, s.price, s.emoji]);
  }
}

async function getStonkPrice(ticker: string): Promise<number> {
  const row = await query('SELECT price FROM stonks WHERE ticker = $1', [ticker]);
  if (row.rows.length) return Number((row.rows[0] as { price: number }).price);
  const base = BASE_STONKS.find((s) => s.ticker === ticker);
  return base?.price ?? 100;
}

async function getMarket(): Promise<Stonk[]> {
  await initStonks();
  const rows = await query('SELECT ticker, name, price, emoji FROM stonks ORDER BY price DESC');
  return (rows.rows as Array<{ ticker: string; name: string; price: number; emoji: string }>).map((r) => ({
    ...r,
    change: Number((((Math.random() * 1.45) - 0.65) * 10).toFixed(2)),
  }));
}

function computeVerifyResult(game: string, serverSeed: string, clientSeed: string, nonce: number): string {
  switch (game) {
    case 'coinflip':
      return diceRoll(serverSeed, clientSeed, nonce) < 50 ? 'heads' : 'tails';
    case 'dice':
      return String(Math.floor(diceRoll(serverSeed, clientSeed, nonce)) + 1);
    case 'crash':
      return `${crashPoint(serverSeed, clientSeed, nonce).toFixed(2)}x`;
    case 'roulette':
      return String(rouletteNumber(serverSeed, clientSeed, nonce));
    case 'slots':
      return slotReels(serverSeed, clientSeed, nonce).join('-');
    default:
      return 'Unsupported game for quick verify';
  }
}

export const economyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/economy/mine', { preHandler: requireJwt }, async (request: AuthedRequest, reply) => {
    const wallet = await walletForRequest(request);
    if (!wallet) {
      reply.code(404).send({ error: 'Wallet not found' });
      return;
    }

    const lastMine = await query('SELECT value FROM kv_store WHERE key = $1', [`mine:${wallet.wallet_id}`]);
    const lastTs = lastMine.rows.length ? Number((lastMine.rows[0] as { value: string }).value) : 0;
    const now = Date.now();
    const elapsed = now - lastTs;

    if (elapsed < COOLDOWN_MS) {
      reply.code(429).send({ error: 'Cooldown active', secondsRemaining: Math.ceil((COOLDOWN_MS - elapsed) / 1000) });
      return;
    }

    const seed = await getActiveSeed();
    const amount = mineAmount(wallet.balance, seed.revealed_seed, wallet.client_seed);
    await query('INSERT OR REPLACE INTO kv_store (key, value) VALUES ($1, $2)', [`mine:${wallet.wallet_id}`, String(now)]);
    const bal = await adjustBalance(wallet.wallet_id, amount, 'mine', `mine:${Date.now()}`, { reason: 'api_mining' });

    reply.send({ ok: true, mined: amount, balance: bal.after, cooldownSeconds: Math.floor(COOLDOWN_MS / 1000) });
  });

  fastify.post<{ Body: Record<string, unknown> }>('/api/economy/transfer', { preHandler: requireJwt }, async (request: AuthedRequest & FastifyRequest<{ Body: Record<string, unknown> }>, reply) => {
    const sender = await walletForRequest(request);
    if (!sender) {
      reply.code(404).send({ error: 'Wallet not found' });
      return;
    }

    const body = request.body ?? {};
    const recipientDiscordId = String(body.recipientDiscordId ?? '');
    const amount = Number.parseInt(String(body.amount), 10);
    if (!recipientDiscordId) {
      reply.code(400).send({ error: 'recipientDiscordId is required' });
      return;
    }

    if (!Number.isFinite(amount) || amount < 1) {
      reply.code(400).send({ error: 'amount must be >= 1' });
      return;
    }

    if (recipientDiscordId === sender.discord_id) {
      reply.code(400).send({ error: 'Cannot transfer to self' });
      return;
    }

    const receiver = await getWalletByDiscordId(recipientDiscordId);
    if (!receiver) {
      reply.code(404).send({ error: 'Recipient not found' });
      return;
    }

    if (amount > sender.balance) {
      reply.code(400).send({ error: 'Insufficient balance' });
      return;
    }

    let senderAfter = sender.balance;
    let receiverAfter = receiver.balance;
    await transaction(async (client) => {
      senderAfter = sender.balance - amount;
      receiverAfter = receiver.balance + amount;

      await client.query('UPDATE wallets SET balance = $1, last_active = unixepoch() WHERE wallet_id = $2', [senderAfter, sender.wallet_id]);
      await client.query('UPDATE wallets SET balance = $1, last_active = unixepoch() WHERE wallet_id = $2', [receiverAfter, receiver.wallet_id]);

      await client.query(
        'INSERT INTO transactions (wallet_id, type, amount, balance_before, balance_after, reference_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [sender.wallet_id, 'transfer_out', -amount, sender.balance, senderAfter, receiver.wallet_id, JSON.stringify({ to: receiver.discord_id })],
      );
      await client.query(
        'INSERT INTO transactions (wallet_id, type, amount, balance_before, balance_after, reference_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [receiver.wallet_id, 'transfer_in', amount, receiver.balance, receiverAfter, sender.wallet_id, JSON.stringify({ from: sender.discord_id })],
      );
    });

    reply.send({ ok: true, amount, senderAfter, receiverAfter, recipient: { username: receiver.username, discordId: receiver.discord_id } });
  });

  fastify.get('/api/economy/shop', { preHandler: requireJwt }, async (_request, reply) => {
    reply.send({ items: ITEMS });
  });

  fastify.post<{ Body: Record<string, unknown> }>('/api/economy/shop/buy', { preHandler: requireJwt }, async (request: AuthedRequest & FastifyRequest<{ Body: Record<string, unknown> }>, reply) => {
    const wallet = await walletForRequest(request);
    if (!wallet) {
      reply.code(404).send({ error: 'Wallet not found' });
      return;
    }

    const body = request.body ?? {};
    const itemId = String(body.itemId ?? '');
    const item = ITEMS[itemId];
    if (!item) {
      reply.code(400).send({ error: 'Unknown shop item' });
      return;
    }

    if (wallet.balance < item.price) {
      reply.code(400).send({ error: 'Insufficient balance' });
      return;
    }

    const bal = await adjustBalance(wallet.wallet_id, -item.price, 'shop', `shop:${itemId}:${Date.now()}`, { item: itemId });
    await query('INSERT INTO purchases (wallet_id, item_id, purchased_at) VALUES ($1,$2,unixepoch()) ON CONFLICT DO NOTHING', [wallet.wallet_id, itemId]);

    reply.send({ ok: true, itemId, item, balance: bal.after });
  });

  fastify.get('/api/economy/stonks', { preHandler: requireJwt }, async (_request, reply) => {
    const market = await getMarket();
    reply.send({ market });
  });

  fastify.post<{ Body: Record<string, unknown> }>('/api/economy/stonks/buy', { preHandler: requireJwt }, async (request: AuthedRequest & FastifyRequest<{ Body: Record<string, unknown> }>, reply) => {
    const wallet = await walletForRequest(request);
    if (!wallet) {
      reply.code(404).send({ error: 'Wallet not found' });
      return;
    }

    await initStonks();

    const body = request.body ?? {};
    const ticker = String(body.ticker ?? '').toUpperCase();
    const shares = Number.parseInt(String(body.shares), 10);
    if (!ticker || !Number.isFinite(shares) || shares < 1) {
      reply.code(400).send({ error: 'ticker and shares >= 1 are required' });
      return;
    }

    const price = await getStonkPrice(ticker);
    const cost = price * shares;
    if (wallet.balance < cost) {
      reply.code(400).send({ error: 'Insufficient balance' });
      return;
    }

    const bal = await adjustBalance(wallet.wallet_id, -cost, 'stonks', `stonks:buy:${ticker}:${Date.now()}`, { ticker, shares, price });
    await query(
      'INSERT INTO stonk_holdings (wallet_id,ticker,shares,avg_price) VALUES ($1,$2,$3,$4) ON CONFLICT(wallet_id,ticker) DO UPDATE SET shares=shares+$3, avg_price=((avg_price*shares+$4*$3)/(shares+$3))',
      [wallet.wallet_id, ticker, shares, price],
    );

    const newPrice = Math.round(price * (1 + Math.random() * 0.02));
    await query('UPDATE stonks SET price=$1 WHERE ticker=$2', [newPrice, ticker]);

    reply.send({ ok: true, ticker, shares, price, cost, balance: bal.after });
  });

  fastify.post<{ Body: Record<string, unknown> }>('/api/economy/stonks/sell', { preHandler: requireJwt }, async (request: AuthedRequest & FastifyRequest<{ Body: Record<string, unknown> }>, reply) => {
    const wallet = await walletForRequest(request);
    if (!wallet) {
      reply.code(404).send({ error: 'Wallet not found' });
      return;
    }

    const body = request.body ?? {};
    const ticker = String(body.ticker ?? '').toUpperCase();
    const shares = Number.parseInt(String(body.shares), 10);
    if (!ticker || !Number.isFinite(shares) || shares < 1) {
      reply.code(400).send({ error: 'ticker and shares >= 1 are required' });
      return;
    }

    const holding = await query('SELECT shares,avg_price FROM stonk_holdings WHERE wallet_id=$1 AND ticker=$2', [wallet.wallet_id, ticker]);
    if (!holding.rows.length) {
      reply.code(400).send({ error: `No holdings for ${ticker}` });
      return;
    }

    const held = Number((holding.rows[0] as { shares: number }).shares);
    const avgBuy = Number((holding.rows[0] as { avg_price: number }).avg_price);
    if (held < shares) {
      reply.code(400).send({ error: `Only ${held} shares available` });
      return;
    }

    const price = await getStonkPrice(ticker);
    const revenue = price * shares;
    const profit = revenue - avgBuy * shares;

    const bal = await adjustBalance(wallet.wallet_id, revenue, 'stonks', `stonks:sell:${ticker}:${Date.now()}`, {
      ticker,
      shares,
      price,
    });

    if (shares >= held) {
      await query('DELETE FROM stonk_holdings WHERE wallet_id=$1 AND ticker=$2', [wallet.wallet_id, ticker]);
    } else {
      await query('UPDATE stonk_holdings SET shares=shares-$1 WHERE wallet_id=$2 AND ticker=$3', [shares, wallet.wallet_id, ticker]);
    }

    const newPrice = Math.max(1, Math.round(price * (1 - Math.random() * 0.02)));
    await query('UPDATE stonks SET price=$1 WHERE ticker=$2', [newPrice, ticker]);

    reply.send({ ok: true, ticker, shares, revenue, profit: Math.round(profit), balance: bal.after });
  });

  fastify.get<{ Params: { betId: string } }>('/api/verify/:betId', { preHandler: requireJwt }, async (request, reply) => {
    const betId = Number.parseInt(String(request.params.betId), 10);
    if (!Number.isFinite(betId)) {
      reply.code(400).send({ error: 'betId must be a number' });
      return;
    }

    const betRes = await query('SELECT * FROM bets WHERE id = $1', [betId]);
    const bet = betRes.rows[0] as
      | {
          id: number;
          game: string;
          bet_amount: number;
          payout: number;
          multiplier: number;
          server_seed_hash: string;
          client_seed: string;
          nonce: number;
          outcome_data: string;
        }
      | undefined;

    if (!bet) {
      reply.code(404).send({ error: 'Bet not found' });
      return;
    }

    const seedRes = await query('SELECT revealed_seed FROM server_seeds WHERE seed_hash = $1 LIMIT 1', [bet.server_seed_hash]);
    const revealedSeed = (seedRes.rows[0] as { revealed_seed: string } | undefined)?.revealed_seed;
    if (!revealedSeed) {
      reply.code(404).send({ error: 'Server seed not found for this bet' });
      return;
    }

    let parsedOutcome: Record<string, unknown> = {};
    try {
      parsedOutcome = JSON.parse(bet.outcome_data || '{}') as Record<string, unknown>;
    } catch {
      parsedOutcome = {};
    }

    const computedResult = computeVerifyResult(bet.game, revealedSeed, bet.client_seed, Number(bet.nonce));
    const resultHex = getResultHex(revealedSeed, bet.client_seed, Number(bet.nonce));

    reply.send({
      ok: true,
      betId: bet.id,
      game: bet.game,
      serverSeedHash: bet.server_seed_hash,
      serverSeed: revealedSeed,
      clientSeed: bet.client_seed,
      nonce: Number(bet.nonce),
      resultHex,
      computedResult,
      stored: {
        betAmount: Number(bet.bet_amount),
        payout: Number(bet.payout),
        multiplier: Number(bet.multiplier),
        outcomeData: parsedOutcome,
      },
    });
  });
};
