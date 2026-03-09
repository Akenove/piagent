import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { query } from '../../database/db';
import {
  dealBlackjack,
  flipCoin,
  playCrash,
  playMines,
  rollDice,
  spinRoulette,
  spinSlots,
  type BlackjackState,
} from '../../games';
import { adjustBalance, getActiveSeed, getWalletByDiscordId, getWalletByWalletId, incrementWalletGameStats, logBet } from '../../utils/economy';

const JWT_SECRET = process.env.JWT_SECRET ?? 'collective-dev-secret';

interface JwtUser {
  discordId: string;
  username: string;
}

type AuthedRequest = FastifyRequest & { user?: JwtUser };

interface BlackjackSession {
  id: string;
  walletId: string;
  amount: number;
  state: BlackjackState;
  nonce: number;
  seedHash: string;
  serverSeed: string;
  clientSeed: string;
  startedAt: number;
}

interface CrashSession {
  id: string;
  walletId: string;
  amount: number;
  crashPoint: number;
  nonce: number;
  seedHash: string;
  hash: string;
  startedAt: number;
}

const gameRateLimit = new Map<string, number>();
const blackjackSessions = new Map<string, BlackjackSession>();
const crashSessions = new Map<string, CrashSession>();

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

async function rateLimitGames(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const discordId = (request as AuthedRequest).user?.discordId;
  if (!discordId) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  const now = Date.now();
  const last = gameRateLimit.get(discordId) ?? 0;
  if (now - last < 1000) {
    reply.code(429).send({ error: 'Rate limit: max 1 game request per second' });
    return;
  }

  gameRateLimit.set(discordId, now);
}

function toInt(value: unknown): number {
  return Number.parseInt(String(value), 10);
}

function toNum(value: unknown): number {
  return Number(value);
}

function badRequest(reply: FastifyReply, message: string): void {
  reply.code(400).send({ error: message });
}

async function settleBet(input: {
  walletId: string;
  game: string;
  amount: number;
  payout: number;
  multiplier: number;
  seedHash: string;
  clientSeed: string;
  nonce: number;
  outcomeData: Record<string, unknown>;
}): Promise<{ betId: number; balance: number }> {
  await adjustBalance(
    input.walletId,
    input.payout - input.amount,
    `bet_${input.game}`,
    `${input.game}:${Date.now()}`,
    {
      amount: input.amount,
      payout: input.payout,
      multiplier: input.multiplier,
      outcomeData: input.outcomeData,
    },
  );

  await incrementWalletGameStats(input.walletId, input.amount, input.payout);

  const betId = await logBet({
    walletId: input.walletId,
    game: input.game,
    betAmount: input.amount,
    payout: input.payout,
    multiplier: input.multiplier,
    serverSeedHash: input.seedHash,
    clientSeed: input.clientSeed,
    nonce: input.nonce,
    outcomeData: input.outcomeData,
  });

  const wallet = await getWalletByWalletId(input.walletId);
  return { betId, balance: wallet?.balance ?? 0 };
}

async function walletFromRequest(request: AuthedRequest) {
  const discordId = request.user?.discordId;
  if (!discordId) return null;
  return getWalletByDiscordId(discordId);
}

function crashMultiplierFromElapsed(elapsedMs: number): number {
  const value = Math.pow(1 + elapsedMs / 1500, 1.08);
  return Math.max(1, Number(value.toFixed(2)));
}

export const gamesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/games/active', { preHandler: requireJwt }, async (request: AuthedRequest, reply) => {
    const wallet = await walletFromRequest(request);
    if (!wallet) {
      reply.code(404).send({ error: 'Wallet not found' });
      return;
    }

    const bj = Array.from(blackjackSessions.values())
      .filter((session) => session.walletId === wallet.wallet_id)
      .map((session) => ({
        id: session.id,
        game: 'blackjack',
        amount: session.amount,
        startedAt: session.startedAt,
        playerHand: session.state.playerHand,
        dealerHand: [session.state.dealerHand[0], '??'],
        playerValue: session.state.playerHand.length,
        canDouble: session.state.canDouble,
      }));

    const crash = Array.from(crashSessions.values())
      .filter((session) => session.walletId === wallet.wallet_id)
      .map((session) => {
        const elapsed = Date.now() - session.startedAt;
        const currentMultiplier = crashMultiplierFromElapsed(elapsed);
        return {
          id: session.id,
          game: 'crash',
          amount: session.amount,
          startedAt: session.startedAt,
          crashPoint: session.crashPoint,
          currentMultiplier,
          crashed: currentMultiplier >= session.crashPoint,
        };
      });

    reply.send({ blackjack: bj, crash });
  });

  fastify.post<{ Params: { game: string }; Body: Record<string, unknown> }>(
    '/api/games/:game',
    { preHandler: [requireJwt, rateLimitGames] },
    async (request: AuthedRequest & FastifyRequest<{ Params: { game: string }; Body: Record<string, unknown> }>, reply) => {
      const game = String(request.params.game || '').toLowerCase();
      const body = request.body ?? {};
      const wallet = await walletFromRequest(request);
      if (!wallet) {
        reply.code(404).send({ error: 'Wallet not found' });
        return;
      }

      try {
        if (game === 'blackjack') {
          const action = String(body.action ?? 'start') as 'start' | 'hit' | 'stand' | 'double';

          if (action === 'start') {
            const amount = toInt(body.amount);
            if (!Number.isFinite(amount) || amount < 1) {
              badRequest(reply, 'amount must be >= 1');
              return;
            }
            if (amount > wallet.balance) {
              reply.code(400).send({ error: 'Insufficient balance' });
              return;
            }

            const activeSeed = await getActiveSeed();
            const first = dealBlackjack(amount, 'start', null, activeSeed.revealed_seed, wallet.client_seed, wallet.nonce);

            await adjustBalance(wallet.wallet_id, -amount, 'bet_blackjack', `blackjack:start:${Date.now()}`, {
              amount,
              action: 'start',
            });

            const session: BlackjackSession = {
              id: `bj_${wallet.wallet_id}_${Date.now()}`,
              walletId: wallet.wallet_id,
              amount,
              state: first.details.gameState,
              nonce: wallet.nonce,
              seedHash: activeSeed.seed_hash,
              serverSeed: activeSeed.revealed_seed,
              clientSeed: wallet.client_seed,
              startedAt: Date.now(),
            };

            if (first.details.status === 'finished') {
              if (first.payout > 0) {
                await adjustBalance(wallet.wallet_id, first.payout, 'win_blackjack', `blackjack:payout:${Date.now()}`, {
                  payout: first.payout,
                  multiplier: first.multiplier,
                });
              }

              await incrementWalletGameStats(wallet.wallet_id, amount, first.payout);
              const betId = await logBet({
                walletId: wallet.wallet_id,
                game: 'blackjack',
                betAmount: amount,
                payout: first.payout,
                multiplier: first.multiplier,
                serverSeedHash: activeSeed.seed_hash,
                clientSeed: wallet.client_seed,
                nonce: wallet.nonce,
                outcomeData: first.details as unknown as Record<string, unknown>,
              });

              const latest = await getWalletByWalletId(wallet.wallet_id);
              reply.send({
                ok: true,
                game: 'blackjack',
                finished: true,
                betId,
                balance: latest?.balance ?? wallet.balance,
                result: first,
              });
              return;
            }

            blackjackSessions.set(session.id, session);
            const latest = await getWalletByWalletId(wallet.wallet_id);
            reply.send({
              ok: true,
              game: 'blackjack',
              finished: false,
              sessionId: session.id,
              balance: latest?.balance ?? wallet.balance,
              result: first,
            });
            return;
          }

          const sessionId = String(body.sessionId ?? '');
          const session = blackjackSessions.get(sessionId);
          if (!session || session.walletId !== wallet.wallet_id) {
            reply.code(404).send({ error: 'Blackjack session not found' });
            return;
          }

          const beforeBet = session.amount;
          const next = dealBlackjack(beforeBet, action, session.state, session.serverSeed, session.clientSeed, session.nonce);
          const currentBet = next.details.gameState.bet;
          const extraWager = currentBet - beforeBet;

          if (extraWager > 0) {
            const refreshed = await getWalletByWalletId(wallet.wallet_id);
            const liveBalance = refreshed?.balance ?? wallet.balance;
            if (liveBalance < extraWager) {
              reply.code(400).send({ error: 'Insufficient balance to double' });
              return;
            }
            await adjustBalance(wallet.wallet_id, -extraWager, 'bet_blackjack_double', `blackjack:double:${Date.now()}`, {
              sessionId,
              extraWager,
            });
          }

          session.state = next.details.gameState;
          session.amount = currentBet;

          if (next.details.status === 'finished') {
            if (next.payout > 0) {
              await adjustBalance(wallet.wallet_id, next.payout, 'win_blackjack', `blackjack:payout:${Date.now()}`, {
                payout: next.payout,
                multiplier: next.multiplier,
              });
            }

            await incrementWalletGameStats(wallet.wallet_id, session.amount, next.payout);
            const betId = await logBet({
              walletId: wallet.wallet_id,
              game: 'blackjack',
              betAmount: session.amount,
              payout: next.payout,
              multiplier: next.multiplier,
              serverSeedHash: session.seedHash,
              clientSeed: session.clientSeed,
              nonce: session.nonce,
              outcomeData: next.details as unknown as Record<string, unknown>,
            });

            blackjackSessions.delete(session.id);
            const latest = await getWalletByWalletId(wallet.wallet_id);
            reply.send({
              ok: true,
              game: 'blackjack',
              finished: true,
              sessionId,
              betId,
              balance: latest?.balance ?? wallet.balance,
              result: next,
            });
            return;
          }

          blackjackSessions.set(session.id, session);
          const latest = await getWalletByWalletId(wallet.wallet_id);
          reply.send({
            ok: true,
            game: 'blackjack',
            finished: false,
            sessionId,
            balance: latest?.balance ?? wallet.balance,
            result: next,
          });
          return;
        }

        if (game === 'crash' && String(body.action || '') === 'start') {
          const amount = toInt(body.amount);
          if (!Number.isFinite(amount) || amount < 1) {
            badRequest(reply, 'amount must be >= 1');
            return;
          }
          if (amount > wallet.balance) {
            reply.code(400).send({ error: 'Insufficient balance' });
            return;
          }

          const activeSeed = await getActiveSeed();
          const probe = playCrash(amount, 100, activeSeed.revealed_seed, wallet.client_seed, wallet.nonce);
          await adjustBalance(wallet.wallet_id, -amount, 'bet_crash', `crash:start:${Date.now()}`, { amount });

          const session: CrashSession = {
            id: `cr_${wallet.wallet_id}_${Date.now()}`,
            walletId: wallet.wallet_id,
            amount,
            crashPoint: probe.details.crashPoint,
            nonce: wallet.nonce,
            seedHash: activeSeed.seed_hash,
            hash: probe.hash,
            startedAt: Date.now(),
          };
          crashSessions.set(session.id, session);

          const latest = await getWalletByWalletId(wallet.wallet_id);
          reply.send({
            ok: true,
            game: 'crash',
            finished: false,
            sessionId: session.id,
            crashPoint: session.crashPoint,
            hash: session.hash,
            balance: latest?.balance ?? wallet.balance,
          });
          return;
        }

        if (game === 'crash' && String(body.action || '') === 'cashout') {
          const sessionId = String(body.sessionId ?? '');
          const session = crashSessions.get(sessionId);
          if (!session || session.walletId !== wallet.wallet_id) {
            reply.code(404).send({ error: 'Crash session not found' });
            return;
          }

          const elapsed = Date.now() - session.startedAt;
          const currentMultiplier = crashMultiplierFromElapsed(elapsed);
          const crashed = currentMultiplier >= session.crashPoint;
          const appliedMultiplier = crashed ? 0 : currentMultiplier;
          const payout = crashed ? 0 : Math.floor(session.amount * currentMultiplier);

          if (payout > 0) {
            await adjustBalance(wallet.wallet_id, payout, 'win_crash', `crash:cashout:${Date.now()}`, {
              multiplier: currentMultiplier,
              crashPoint: session.crashPoint,
            });
          }

          await incrementWalletGameStats(wallet.wallet_id, session.amount, payout);
          const betId = await logBet({
            walletId: wallet.wallet_id,
            game: 'crash',
            betAmount: session.amount,
            payout,
            multiplier: appliedMultiplier,
            serverSeedHash: session.seedHash,
            clientSeed: wallet.client_seed,
            nonce: session.nonce,
            outcomeData: {
              crashPoint: session.crashPoint,
              cashout: currentMultiplier,
              elapsed,
              crashed,
            },
          });

          crashSessions.delete(sessionId);
          const latest = await getWalletByWalletId(wallet.wallet_id);
          reply.send({
            ok: true,
            game: 'crash',
            finished: true,
            sessionId,
            betId,
            balance: latest?.balance ?? wallet.balance,
            result: {
              won: payout > 0,
              payout,
              multiplier: appliedMultiplier,
              details: {
                crashPoint: session.crashPoint,
                cashout: currentMultiplier,
                crashed,
              },
              hash: session.hash,
            },
          });
          return;
        }

        const amount = toInt(body.amount);
        if (!Number.isFinite(amount) || amount < 1) {
          badRequest(reply, 'amount must be >= 1');
          return;
        }

        if (amount > wallet.balance) {
          reply.code(400).send({ error: 'Insufficient balance' });
          return;
        }

        const activeSeed = await getActiveSeed();
        let result:
          | ReturnType<typeof flipCoin>
          | ReturnType<typeof rollDice>
          | ReturnType<typeof playCrash>
          | ReturnType<typeof spinRoulette>
          | ReturnType<typeof spinSlots>
          | ReturnType<typeof playMines>;

        if (game === 'coinflip') {
          const choice = String(body.choice || '').toLowerCase();
          if (choice !== 'heads' && choice !== 'tails') {
            badRequest(reply, 'choice must be heads or tails');
            return;
          }
          result = flipCoin(amount, choice, activeSeed.revealed_seed, wallet.client_seed, wallet.nonce);
        } else if (game === 'dice') {
          const target = toInt(body.target);
          if (!Number.isFinite(target) || target < 2 || target > 95) {
            badRequest(reply, 'target must be between 2 and 95');
            return;
          }
          result = rollDice(amount, target, activeSeed.revealed_seed, wallet.client_seed, wallet.nonce);
        } else if (game === 'crash') {
          const cashout = toNum(body.cashout);
          if (!Number.isFinite(cashout) || cashout < 1.01 || cashout > 100) {
            badRequest(reply, 'cashout must be between 1.01 and 100');
            return;
          }
          result = playCrash(amount, cashout, activeSeed.revealed_seed, wallet.client_seed, wallet.nonce);
        } else if (game === 'roulette') {
          const bet = String(body.bet ?? '');
          result = spinRoulette(amount, bet, activeSeed.revealed_seed, wallet.client_seed, wallet.nonce);
        } else if (game === 'slots') {
          result = spinSlots(amount, activeSeed.revealed_seed, wallet.client_seed, wallet.nonce);
        } else if (game === 'mines') {
          const mineCount = toInt(body.mineCount);
          const reveals = Array.isArray(body.reveals) ? body.reveals.map((n: unknown) => toInt(n)) : [];
          if (!Number.isFinite(mineCount) || mineCount < 1 || mineCount > 24) {
            badRequest(reply, 'mineCount must be between 1 and 24');
            return;
          }
          result = playMines(amount, mineCount, reveals, activeSeed.revealed_seed, wallet.client_seed, wallet.nonce);
        } else {
          badRequest(reply, `Unsupported game: ${game}`);
          return;
        }

        const settled = await settleBet({
          walletId: wallet.wallet_id,
          game,
          amount,
          payout: result.payout,
          multiplier: result.multiplier,
          seedHash: activeSeed.seed_hash,
          clientSeed: wallet.client_seed,
          nonce: wallet.nonce,
          outcomeData: result.details as unknown as Record<string, unknown>,
        });

        reply.send({ ok: true, game, betId: settled.betId, balance: settled.balance, result });
      } catch (error: any) {
        reply.code(400).send({ error: error?.message ?? 'Failed to process game' });
      }
    },
  );

  fastify.get('/api/games/active/all', { preHandler: requireJwt }, async (_request, reply) => {
    const [usersWithBets] = await Promise.all([
      query('SELECT COUNT(*) as count FROM wallets WHERE games_played > 0'),
    ]);

    reply.send({
      blackjack: blackjackSessions.size,
      crash: crashSessions.size,
      usersWithBets: Number((usersWithBets.rows[0] as { count: number }).count),
    });
  });
};

export async function listActiveSessionsForWallet(walletId: string): Promise<{ blackjack: BlackjackSession[]; crash: CrashSession[] }> {
  return {
    blackjack: Array.from(blackjackSessions.values()).filter((s) => s.walletId === walletId),
    crash: Array.from(crashSessions.values()).filter((s) => s.walletId === walletId),
  };
}
