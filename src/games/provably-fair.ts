import crypto from 'crypto';

/**
 * PROVABLY FAIR ENGINE — HMAC-SHA256 (Stake.com Standard)
 * 
 * Flow:
 * 1. Server generates server_seed, shows SHA256(server_seed) to player
 * 2. Player sets client_seed (or uses default)
 * 3. Each bet: HMAC_SHA256(server_seed, client_seed:nonce:round) → bytes → result
 * 4. Nonce increments per bet
 * 5. On seed rotation: old server_seed revealed, player verifies hash
 */

// Generate new server seed pair
export function generateServerSeed(): { seed: string; hash: string } {
  const seed = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return { seed, hash };
}

// Generate random client seed
export function generateClientSeed(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Core: Generate provably fair bytes from seeds
export function generateBytes(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor: number = 0
): number[] {
  let currentRound = Math.floor(cursor / 32);
  let currentRoundCursor = cursor - currentRound * 32;
  
  const bytes: number[] = [];
  while (bytes.length < 4) {
    const hmac = crypto.createHmac('sha256', serverSeed)
      .update(`${clientSeed}:${nonce}:${currentRound}`)
      .digest();
    
    while (currentRoundCursor < 32 && bytes.length < 4) {
      bytes.push(hmac[currentRoundCursor]);
      currentRoundCursor++;
    }
    currentRoundCursor = 0;
    currentRound++;
  }
  return bytes;
}

// Convert 4 bytes to float [0, 1)
export function bytesToFloat(bytes: number[]): number {
  return bytes.reduce((result, value, i) => {
    return result + value / Math.pow(256, i + 1);
  }, 0);
}

// Get raw HMAC hex for verification display
export function getResultHex(serverSeed: string, clientSeed: string, nonce: number): string {
  return crypto.createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}:0`)
    .digest('hex');
}

// ════════════════════════════════════════
// GAME IMPLEMENTATIONS
// ════════════════════════════════════════

export function coinFlip(serverSeed: string, clientSeed: string, nonce: number): 'heads' | 'tails' {
  const float = bytesToFloat(generateBytes(serverSeed, clientSeed, nonce));
  return float < 0.5 ? 'heads' : 'tails';
}

export function diceRoll(serverSeed: string, clientSeed: string, nonce: number): number {
  const float = bytesToFloat(generateBytes(serverSeed, clientSeed, nonce));
  return Math.floor(float * 10000) / 100; // 0.00 - 99.99
}

export function crashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
  const float = bytesToFloat(generateBytes(serverSeed, clientSeed, nonce));
  const houseEdge = 0.01;
  if (float < houseEdge) return 1.00;
  return Math.floor((1 / (1 - float)) * 100) / 100;
}

export function rouletteNumber(serverSeed: string, clientSeed: string, nonce: number): number {
  const float = bytesToFloat(generateBytes(serverSeed, clientSeed, nonce));
  return Math.floor(float * 37); // 0-36 European
}

export function slotReels(serverSeed: string, clientSeed: string, nonce: number): number[] {
  const results: number[] = [];
  for (let i = 0; i < 3; i++) {
    const float = bytesToFloat(generateBytes(serverSeed, clientSeed, nonce, i * 4));
    results.push(Math.floor(float * 10));
  }
  return results;
}

export function minesField(serverSeed: string, clientSeed: string, nonce: number, mineCount: number = 5): number[] {
  const tiles = Array.from({ length: 25 }, (_, i) => i);
  const mines: number[] = [];
  for (let i = 0; i < mineCount; i++) {
    const float = bytesToFloat(generateBytes(serverSeed, clientSeed, nonce, i * 4));
    const index = Math.floor(float * (tiles.length - i));
    mines.push(tiles.splice(index, 1)[0]);
  }
  return mines.sort((a, b) => a - b);
}

// ════════════════════════════════════════
// VERIFICATION
// ════════════════════════════════════════

export function verifyServerSeed(serverSeed: string, expectedHash: string): boolean {
  const computed = crypto.createHash('sha256').update(serverSeed).digest('hex');
  return computed === expectedHash;
}

export interface VerifyResult {
  valid: boolean;
  serverSeedHash: string;
  resultHex: string;
  resultFloat: number;
  gameResult: string;
}

export function verifyBet(
  serverSeed: string,
  serverSeedHash: string,
  clientSeed: string,
  nonce: number,
  game: string
): VerifyResult {
  const valid = verifyServerSeed(serverSeed, serverSeedHash);
  const float = bytesToFloat(generateBytes(serverSeed, clientSeed, nonce));
  const hex = getResultHex(serverSeed, clientSeed, nonce);
  
  let gameResult: string;
  switch (game) {
    case 'coinflip': gameResult = coinFlip(serverSeed, clientSeed, nonce); break;
    case 'dice': gameResult = diceRoll(serverSeed, clientSeed, nonce).toString(); break;
    case 'crash': gameResult = crashPoint(serverSeed, clientSeed, nonce).toFixed(2) + 'x'; break;
    case 'roulette': gameResult = rouletteNumber(serverSeed, clientSeed, nonce).toString(); break;
    case 'slots': gameResult = slotReels(serverSeed, clientSeed, nonce).join('-'); break;
    default: gameResult = float.toString();
  }
  
  return {
    valid,
    serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
    resultHex: hex,
    resultFloat: float,
    gameResult,
  };
}
