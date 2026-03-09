import { getResultHex, rouletteNumber } from './provably-fair';
import type { GameResult } from './coinflip';

const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function evaluateBet(spin: number, bet: string): { won: boolean; multiplier: number } {
  const lower = bet.toLowerCase();
  if (lower === 'red') return { won: REDS.has(spin), multiplier: 2 };
  if (lower === 'black') return { won: spin !== 0 && !REDS.has(spin), multiplier: 2 };
  if (lower === 'green') return { won: spin === 0, multiplier: 14 };
  if (lower === 'odd') return { won: spin !== 0 && spin % 2 === 1, multiplier: 2 };
  if (lower === 'even') return { won: spin !== 0 && spin % 2 === 0, multiplier: 2 };
  if (lower === 'low') return { won: spin >= 1 && spin <= 18, multiplier: 2 };
  if (lower === 'high') return { won: spin >= 19 && spin <= 36, multiplier: 2 };

  const num = Number(lower);
  if (Number.isInteger(num) && num >= 0 && num <= 36) return { won: spin === num, multiplier: 36 };

  return { won: false, multiplier: 0 };
}

export function spinRoulette(
  amount: number,
  bet: string,
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): GameResult<{ spin: number; bet: string; color: 'red' | 'black' | 'green' }> {
  const spin = rouletteNumber(serverSeed, clientSeed, nonce);
  const outcome = evaluateBet(spin, bet);
  if (outcome.multiplier === 0) {
    throw new Error('Invalid roulette bet');
  }

  const color = spin === 0 ? 'green' : REDS.has(spin) ? 'red' : 'black';
  return {
    won: outcome.won,
    payout: outcome.won ? Math.floor(amount * outcome.multiplier) : 0,
    multiplier: outcome.won ? outcome.multiplier : 0,
    details: { spin, bet, color },
    hash: getResultHex(serverSeed, clientSeed, nonce),
  };
}
