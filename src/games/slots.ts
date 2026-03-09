import { getResultHex, slotReels } from './provably-fair';
import type { GameResult } from './coinflip';

const SYMBOLS = ['cherry', 'orange', 'lemon', 'grape', 'diamond', 'slot', 'seven'] as const;

function payoutFor(symbols: readonly string[], amount: number): { payout: number; multiplier: number } {
  const [a, b, c] = symbols;
  if (a === 'seven' && b === 'seven' && c === 'seven') return { payout: amount * 50, multiplier: 50 };
  if (a === 'diamond' && b === 'diamond' && c === 'diamond') return { payout: amount * 25, multiplier: 25 };
  if (a === 'slot' && b === 'slot' && c === 'slot') return { payout: amount * 15, multiplier: 15 };
  if (a === b && b === c) return { payout: amount * 8, multiplier: 8 };
  if (a === b || b === c || a === c) return { payout: Math.floor(amount * 1.5), multiplier: 1.5 };
  return { payout: 0, multiplier: 0 };
}

export function spinSlots(
  amount: number,
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): GameResult<{ reels: string[]; indexes: number[] }> {
  const indexes = slotReels(serverSeed, clientSeed, nonce);
  const reels = indexes.map((i) => SYMBOLS[i % SYMBOLS.length]);
  const result = payoutFor(reels, amount);

  return {
    won: result.payout > 0,
    payout: result.payout,
    multiplier: result.multiplier,
    details: { reels: [...reels], indexes },
    hash: getResultHex(serverSeed, clientSeed, nonce),
  };
}
