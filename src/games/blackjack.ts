import { createHash } from 'crypto';
import { bytesToFloat, generateBytes, getResultHex } from './provably-fair';
import type { GameResult } from './coinflip';

const SUITS = ['S', 'H', 'D', 'C'] as const;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

type BlackjackAction = 'start' | 'hit' | 'stand' | 'double';

export interface BlackjackState {
  deck: string[];
  playerHand: string[];
  dealerHand: string[];
  bet: number;
  status: 'active' | 'finished';
  canDouble: boolean;
}

interface BlackjackDetails {
  action: BlackjackAction;
  playerHand: string[];
  dealerHand: string[];
  playerValue: number;
  dealerValue: number;
  dealerHidden: boolean;
  status: 'active' | 'finished';
  result: 'win' | 'loss' | 'push' | 'blackjack' | 'playing';
  gameState: BlackjackState;
}

function makeDeck(): string[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => `${rank}${suit}`));
}

function cardValue(card: string): number {
  const rank = card.slice(0, -1);
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
  return Number(rank);
}

function handValue(hand: string[]): number {
  let value = hand.reduce((acc, card) => acc + cardValue(card), 0);
  let aces = hand.filter((c) => c.startsWith('A')).length;
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  return value;
}

function shuffleDeck(deck: string[], serverSeed: string, clientSeed: string, nonce: number): string[] {
  const arr = [...deck];
  let cursor = 0;
  for (let i = arr.length - 1; i > 0; i--) {
    const bytes = generateBytes(serverSeed, clientSeed, nonce, cursor);
    const float = bytesToFloat(bytes);
    const j = Math.floor(float * (i + 1));
    [arr[i], arr[j]] = [arr[j] as string, arr[i] as string];
    cursor += 4;
  }
  return arr;
}

function settle(state: BlackjackState): { payout: number; multiplier: number; won: boolean; result: BlackjackDetails['result'] } {
  const playerValue = handValue(state.playerHand);
  const dealerValue = handValue(state.dealerHand);

  if (playerValue > 21) return { payout: 0, multiplier: 0, won: false, result: 'loss' };
  if (dealerValue > 21 || playerValue > dealerValue) {
    return { payout: Math.floor(state.bet * 2), multiplier: 2, won: true, result: 'win' };
  }
  if (playerValue === dealerValue) {
    return { payout: state.bet, multiplier: 1, won: false, result: 'push' };
  }
  return { payout: 0, multiplier: 0, won: false, result: 'loss' };
}

function detailsFor(
  action: BlackjackAction,
  state: BlackjackState,
  result: BlackjackDetails['result'],
  dealerHidden: boolean,
): BlackjackDetails {
  return {
    action,
    playerHand: [...state.playerHand],
    dealerHand: [...state.dealerHand],
    playerValue: handValue(state.playerHand),
    dealerValue: handValue(state.dealerHand),
    dealerHidden,
    status: state.status,
    result,
    gameState: {
      deck: [...state.deck],
      playerHand: [...state.playerHand],
      dealerHand: [...state.dealerHand],
      bet: state.bet,
      status: state.status,
      canDouble: state.canDouble,
    },
  };
}

export function dealBlackjack(
  amount: number,
  action: BlackjackAction,
  gameState: BlackjackState | null,
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): GameResult<BlackjackDetails> {
  let state: BlackjackState;
  let won = false;
  let payout = 0;
  let multiplier = 0;
  let dealerHidden = false;
  let result: BlackjackDetails['result'] = 'playing';

  if (action === 'start') {
    const deck = shuffleDeck(makeDeck(), serverSeed, clientSeed, nonce);
    state = {
      deck,
      playerHand: [deck.pop() as string, deck.pop() as string],
      dealerHand: [deck.pop() as string, deck.pop() as string],
      bet: amount,
      status: 'active',
      canDouble: true,
    };

    const playerValue = handValue(state.playerHand);
    if (playerValue === 21) {
      state.status = 'finished';
      payout = Math.floor(amount * 2.5);
      multiplier = 2.5;
      won = true;
      result = 'blackjack';
    } else {
      dealerHidden = true;
    }
  } else {
    if (!gameState || gameState.status === 'finished') {
      throw new Error('No active blackjack game');
    }
    state = {
      deck: [...gameState.deck],
      playerHand: [...gameState.playerHand],
      dealerHand: [...gameState.dealerHand],
      bet: gameState.bet,
      status: gameState.status,
      canDouble: gameState.canDouble,
    };

    if (action === 'hit') {
      state.playerHand.push(state.deck.pop() as string);
      state.canDouble = false;
      if (handValue(state.playerHand) > 21) {
        state.status = 'finished';
        result = 'loss';
      }
      dealerHidden = state.status !== 'finished';
    }

    if (action === 'double') {
      if (!state.canDouble) {
        throw new Error('Double is only available immediately after the initial deal');
      }
      state.bet = state.bet * 2;
      state.canDouble = false;
      state.playerHand.push(state.deck.pop() as string);
      action = 'stand';
    }

    if (action === 'stand') {
      while (handValue(state.dealerHand) < 17) {
        state.dealerHand.push(state.deck.pop() as string);
      }
      state.status = 'finished';
      dealerHidden = false;
      const settled = settle(state);
      payout = settled.payout;
      multiplier = settled.multiplier;
      won = settled.won;
      result = settled.result;
    }
  }

  if (state.status === 'finished' && result === 'playing') {
    const settled = settle(state);
    payout = settled.payout;
    multiplier = settled.multiplier;
    won = settled.won;
    result = settled.result;
    dealerHidden = false;
  }

  const details = detailsFor(action, state, result, dealerHidden);
  return {
    won,
    payout,
    multiplier,
    details,
    hash: `${getResultHex(serverSeed, clientSeed, nonce)}:${createHash('sha256').update(JSON.stringify(details.gameState)).digest('hex').slice(0, 16)}`,
  };
}
