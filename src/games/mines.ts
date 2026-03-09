import { getResultHex, minesField } from './provably-fair';
import type { GameResult } from './coinflip';

function computeMultiplier(mineCount: number, safeReveals: number): number {
  let multiplier = 1;
  for (let i = 0; i < safeReveals; i++) {
    multiplier *= (25 - i) / (25 - mineCount - i);
  }
  return Number((multiplier * 0.98).toFixed(4));
}

export function playMines(
  amount: number,
  mineCount: number,
  reveals: number[],
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): GameResult<{ mineCount: number; reveals: number[]; mines: number[]; hitMine: boolean; safeReveals: number }> {
  const mines = minesField(serverSeed, clientSeed, nonce, mineCount);
  const mineSet = new Set(mines);

  let safeReveals = 0;
  let hitMine = false;
  const uniqueReveals = Array.from(new Set(reveals));
  for (const tile of uniqueReveals) {
    if (tile < 0 || tile > 24) continue;
    if (mineSet.has(tile)) {
      hitMine = true;
      break;
    }
    safeReveals++;
  }

  const multiplier = !hitMine && safeReveals > 0 ? computeMultiplier(mineCount, safeReveals) : 0;
  const payout = multiplier > 0 ? Math.floor(amount * multiplier) : 0;

  return {
    won: payout > 0,
    payout,
    multiplier,
    details: {
      mineCount,
      reveals: uniqueReveals,
      mines,
      hitMine,
      safeReveals,
    },
    hash: getResultHex(serverSeed, clientSeed, nonce),
  };
}
