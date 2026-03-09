import { crashPoint, getResultHex } from './provably-fair';
import type { GameResult } from './coinflip';

export function playCrash(
  amount: number,
  cashout: number,
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): GameResult<{ crashPoint: number; cashout: number }> {
  const point = crashPoint(serverSeed, clientSeed, nonce);
  const won = point >= cashout;
  const multiplier = won ? cashout : 0;

  return {
    won,
    payout: won ? Math.floor(amount * cashout) : 0,
    multiplier,
    details: { crashPoint: point, cashout },
    hash: getResultHex(serverSeed, clientSeed, nonce),
  };
}
