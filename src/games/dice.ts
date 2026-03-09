import { diceRoll, getResultHex } from './provably-fair';
import type { GameResult } from './coinflip';

export function rollDice(
  amount: number,
  target: number,
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): GameResult<{ roll: number; target: number }> {
  const roll = Math.floor(diceRoll(serverSeed, clientSeed, nonce)) + 1;
  const won = roll < target;
  const multiplier = won ? 98 / target : 0;

  return {
    won,
    payout: won ? Math.floor(amount * multiplier) : 0,
    multiplier,
    details: { roll, target },
    hash: getResultHex(serverSeed, clientSeed, nonce),
  };
}
