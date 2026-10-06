import { buildDeck, shuffle, type Card, type Rank, type Suit } from './cards';
import { STANDARD_MAUA, type RulesConfig } from './rules';

export interface GameState {
  config: RulesConfig;
  hands: Card[][];
  drawPile: Card[];
  discardPile: Card[];
  currentPlayer: number;
  direction: 1 | -1;
  /** Accumulated picks the current player owes (0 = none). */
  pendingPenalty: number;
  pendingPenaltyRank: string | null;
  /** Declared suit after an Ace (null = follow top card normally). */
  activeSuit: Suit | null;
  /** Suit in force right before the latest Ace request (memory aid, null if none). */
  lastSuitBeforeRequest: Suit | null;
  /** Exact-card request after a super ace (null = none). Rank + suit must match exactly. */
  activeCardRequest: { rank: Rank; suit: Suit } | null;
  /** Number of players to skip at next advance (from Jacks). */
  pendingSkip: number;
  kadiCalls: boolean[];
  kadiCallTurn: number[];
  turnNumber: number;
  gameOver: boolean;
  winnerIndex: number | null;
  lastEffect: string | null;
}

export interface CreateGameOptions {
  numPlayers: number;
  config?: RulesConfig;
  random?: () => number;
}

export function topCard(state: GameState): Card {
  return state.discardPile[state.discardPile.length - 1];
}

export function createGame({ numPlayers, config = STANDARD_MAUA, random = Math.random }: CreateGameOptions): GameState {
  if (numPlayers < 2 || numPlayers > 5) throw new Error('Kadi supports 2-5 players');
  let deck = shuffle(buildDeck(config.jokersEnabled), random);

  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  for (let i = 0; i < config.dealCount; i++) {
    for (let p = 0; p < numPlayers; p++) {
      const c = deck.pop();
      if (c) hands[p].push(c);
    }
  }

  // Find a valid starter (not blacklisted). Reshuffle discards back if needed.
  let starterIndex = deck.findIndex((c) => !config.starterBlacklist.includes(c.rank));
  if (starterIndex === -1) {
    deck = shuffle(buildDeck(config.jokersEnabled), random);
    starterIndex = 0;
  }
  const [starter] = deck.splice(starterIndex, 1);

  return {
    // Copy: games must never alias (and pollute) the shared preset objects.
    config: { ...config },
    hands,
    drawPile: deck,
    discardPile: [starter],
    currentPlayer: 0,
    direction: 1,
    pendingPenalty: 0,
    pendingPenaltyRank: null,
    activeSuit: null,
    lastSuitBeforeRequest: null,
    activeCardRequest: null,
    pendingSkip: 0,
    kadiCalls: Array(numPlayers).fill(false),
    kadiCallTurn: Array(numPlayers).fill(-1),
    turnNumber: 0,
    gameOver: false,
    winnerIndex: null,
    lastEffect: null,
  };
}

/** Move turn forward, consuming pending skips. */
export function advanceTurn(state: GameState): void {
  const n = state.hands.length;
  const steps = 1 + state.pendingSkip;
  state.pendingSkip = 0;
  let next = state.currentPlayer;
  for (let i = 0; i < steps; i++) {
    next = (next + state.direction + n) % n;
  }
  state.currentPlayer = next;
  state.turnNumber += 1;
}

/** Replenish draw pile from discards (keep top). No-op if impossible. */
export function replenishDrawPile(state: GameState, random: () => number = Math.random): void {
  if (state.drawPile.length > 0 || state.discardPile.length <= 1) return;
  const top = state.discardPile.pop()!;
  state.drawPile = shuffle(state.discardPile, random);
  state.discardPile = [top];
}

export function drawCards(state: GameState, playerIndex: number, count: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) replenishDrawPile(state);
    const c = state.drawPile.pop();
    if (!c) break;
    state.hands[playerIndex].push(c);
    drawn.push(c);
  }
  return drawn;
}
