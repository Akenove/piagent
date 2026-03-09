import { coinFlip, getResultHex } from './provably-fair';

export interface GameResult<TDetails = Record<string, unknown>> {
  won: boolean;
  payout: number;
  multiplier: number;
  details: TDetails;
  hash: string;
}

export function flipCoin(
  amount: number,
  choice: 'heads' | 'tails',
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): GameResult<{ choice: 'heads' | 'tails'; result: 'heads' | 'tails' }> {
  const result = coinFlip(serverSeed, clientSeed, nonce);
  const won = result === choice;
  const multiplier = won ? 1.98 : 0;

  return {
    won,
    payout: won ? Math.floor(amount * multiplier) : 0,
    multiplier,
    details: { choice, result },
    hash: getResultHex(serverSeed, clientSeed, nonce),
  };
}
