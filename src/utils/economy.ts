import crypto from 'crypto';
import { User } from 'discord.js';
import { query, transaction } from '../database/db';
import { generateClientSeed } from '../games/provably-fair';
import { liveBus } from '../api/live';

export interface WalletRecord {
  wallet_id: string;
  discord_id: string;
  username: string;
  balance: number;
  risk_score: number;
  games_played: number;
  total_wagered: number;
  biggest_win: number;
  created_at: number;
  last_active: number;
  client_seed: string;
  nonce: number;
}

export async function getWalletByDiscordId(discordId: string): Promise<WalletRecord | null> {
  const result = await query('SELECT * FROM wallets WHERE discord_id = $1', [discordId]);
  return (result.rows[0] as WalletRecord | undefined) ?? null;
}

export async function getWalletByWalletId(walletId: string): Promise<WalletRecord | null> {
  const result = await query('SELECT * FROM wallets WHERE wallet_id = $1', [walletId]);
  return (result.rows[0] as WalletRecord | undefined) ?? null;
}

export async function ensureWalletForUser(user: User): Promise<WalletRecord> {
  const existing = await getWalletByDiscordId(user.id);
  if (existing) return existing;

  const walletId = crypto.randomUUID();
  const username = user.username;
  const clientSeed = generateClientSeed();

  await transaction(async (client) => {
    await client.query(
      'INSERT INTO wallets (wallet_id, discord_id, username, balance, client_seed, nonce) VALUES ($1, $2, $3, 500, $4, 0)',
      [walletId, user.id, username, clientSeed],
    );
    await client.query(
      'INSERT INTO transactions (wallet_id, type, amount, balance_before, balance_after, reference_id, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [walletId, 'onboarding_bonus', 500, 0, 500, user.id, JSON.stringify({ reason: 'Auto wallet creation' })],
    );
  });

  const created = await getWalletByDiscordId(user.id);
  if (!created) throw new Error('Wallet creation failed.');
  return created;
}

export async function getWalletRank(walletId: string): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) + 1 AS rank FROM wallets WHERE balance > (SELECT balance FROM wallets WHERE wallet_id = $1)',
    [walletId],
  );
  return Number((result.rows[0] as { rank: number }).rank || 1);
}

export async function getWinRate(walletId: string): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) AS total, SUM(CASE WHEN payout > bet_amount THEN 1 ELSE 0 END) AS wins FROM bets WHERE wallet_id = $1',
    [walletId],
  );
  const row = result.rows[0] as { total: number | null; wins: number | null } | undefined;
  const total = Number(row?.total ?? 0);
  const wins = Number(row?.wins ?? 0);
  if (total === 0) return 0;
  return (wins / total) * 100;
}

export async function adjustBalance(
  walletId: string,
  delta: number,
  type: string,
  referenceId: string,
  metadata: Record<string, unknown> = {},
): Promise<{ before: number; after: number }> {
  const wallet = await getWalletByWalletId(walletId);
  if (!wallet) throw new Error('Wallet not found.');

  const before = Number(wallet.balance);
  const after = before + delta;
  if (after < 0) throw new Error('Insufficient balance.');

  await transaction(async (client) => {
    await client.query('UPDATE wallets SET balance = $1, last_active = unixepoch() WHERE wallet_id = $2', [after, walletId]);
    await client.query(
      'INSERT INTO transactions (wallet_id, type, amount, balance_before, balance_after, reference_id, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [walletId, type, delta, before, after, referenceId, JSON.stringify(metadata)],
    );
  });

  liveBus.emitEvent('balance_update', { walletId, before, after, delta, type });
  return { before, after };
}

export async function getActiveSeed(): Promise<{ id: number; seed_hash: string; revealed_seed: string }> {
  const result = await query('SELECT * FROM server_seeds WHERE active = 1 ORDER BY id DESC LIMIT 1');
  const seed = result.rows[0] as { id: number; seed_hash: string; revealed_seed: string } | undefined;
  if (!seed) throw new Error('No active server seed.');
  return seed;
}

export async function logBet(input: {
  walletId: string;
  game: string;
  betAmount: number;
  payout: number;
  multiplier: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  outcomeData: Record<string, unknown>;
}): Promise<number> {
  const result = await query(
    `INSERT INTO bets (wallet_id, game, bet_amount, payout, multiplier, server_seed_hash, client_seed, nonce, outcome_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      input.walletId,
      input.game,
      input.betAmount,
      input.payout,
      input.multiplier,
      input.serverSeedHash,
      input.clientSeed,
      input.nonce,
      JSON.stringify(input.outcomeData),
    ],
  );
  const betId = Number((result.rows[0] as { id: number }).id);
  liveBus.emitEvent('new_bet', {
    id: betId,
    walletId: input.walletId,
    game: input.game,
    betAmount: input.betAmount,
    payout: input.payout,
    multiplier: input.multiplier,
  });
  return betId;
}

export async function incrementWalletGameStats(walletId: string, wagered: number, payout: number): Promise<void> {
  const biggestWinDelta = Math.max(0, payout - wagered);
  await query(
    `UPDATE wallets
     SET games_played = games_played + 1,
         total_wagered = total_wagered + $1,
         biggest_win = CASE WHEN $2 > biggest_win THEN $2 ELSE biggest_win END,
         nonce = nonce + 1,
         last_active = unixepoch()
     WHERE wallet_id = $3`,
    [wagered, biggestWinDelta, walletId],
  );
}
