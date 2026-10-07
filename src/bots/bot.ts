import type { Card, Suit } from '../engine/cards';
import { isPenaltyRank, isWinningRank } from '../engine/rules';
import { isSuperAceCombo, comboLeavesQuestionOpen, legalSingles, validateCombo } from '../engine/validator';
import { topCard, type GameState } from '../engine/state';

// Re-export for single import path (validator lives in engine/validator)
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface BotMove {
  cards: Card[];
  declaredSuit?: Suit | null;
  /** Exact card demanded when the combo is a super ace. */
  requestedCard?: { rank: Card['rank']; suit: Suit } | null;
}

/** Most common suit left in hand — for Ace requests. */
export function bestSuit(hand: Card[]): Suit {
  const count: Record<Suit, number> = { hearts: 0, diamonds: 0, spades: 0, clubs: 0 };
  for (const c of hand) {
    if (c.suit !== 'none') count[c.suit as Suit] += 1;
  }
  let best: Suit = 'hearts';
  for (const s of Object.keys(count) as Suit[]) {
    if (count[s] > count[best]) best = s;
  }
  return best;
}

/** Two-card combos closing with an answer (Q + same-suit answer, suit chains). */
function questionCombos(state: GameState, playerIndex: number): Card[][] {
  const hand = state.hands[playerIndex];
  const combos: Card[][] = [];
  for (const q of hand) {
    // Lone questions are legal (draw obligation), so always look for a closing answer.
    for (const a of hand) {
      if (a.id === q.id || !isWinningRank(a.rank, state.config)) continue;
      if (validateCombo([q, a], state, playerIndex).ok) combos.push([q, a]);
    }
  }
  return combos;
}

/** Same-rank multi-drops where the first card is legal (e.g. J+J, K+K, 7+7). */
function pairCombos(state: GameState, playerIndex: number): Card[][] {
  const hand = state.hands[playerIndex];
  const byRank = new Map<string, Card[]>();
  for (const c of hand) {
    const arr = byRank.get(c.rank) ?? [];
    arr.push(c);
    byRank.set(c.rank, arr);
  }
  const combos: Card[][] = [];
  for (const group of byRank.values()) {
    if (group.length < 2) continue;
    for (let n = 2; n <= group.length; n++) {
      const combo = group.slice(0, n);
      // Order matters (first must match top) — try both directions.
      if (validateCombo(combo, state, playerIndex).ok) combos.push(combo);
      else {
        const rev = [...combo].reverse();
        if (validateCombo(rev, state, playerIndex).ok) combos.push(rev);
      }
    }
  }
  return combos;
}

function randomOf<T>(arr: T[], random: () => number): T {
  return arr[Math.floor(random() * arr.length)];
}

/** Exact card to demand after a super ace: a card the bot holds (single deck ⇒ rival can't). */
export function chooseRequestCard(hand: Card[]): { rank: Card['rank']; suit: Suit } {
  const suit = bestSuit(hand);
  const own = hand.find((c) => c.suit === suit && c.rank !== 'A' && c.rank !== 'JOKER')
    ?? hand.find((c) => c.suit !== 'none')
    ?? hand[0];
  if (!own || own.suit === 'none') return { rank: '5', suit };
  return { rank: own.rank, suit: own.suit as Suit };
}

/** Attach suit/request declarations to a chosen combo. */
function withDeclarations(
  state: GameState,
  hand: Card[],
  combo: Card[],
): Pick<BotMove, 'declaredSuit' | 'requestedCard'> {
  // Blocks call nothing — never declare on a penalty answer.
  if (state.pendingPenalty > 0) return { declaredSuit: null, requestedCard: null };
  // A lone Ace lifting a demand inherits the demanded suit — nothing to declare.
  if (state.activeCardRequest && !isSuperAceCombo(combo, state)) {
    return { declaredSuit: null, requestedCard: null };
  }
  const ace = combo.find((c) => c.rank === 'A');
  const rest = hand.filter((h) => !combo.some((p) => p.id === h.id));
  if (isSuperAceCombo(combo, state)) {
    return { declaredSuit: null, requestedCard: chooseRequestCard(rest.length > 0 ? rest : hand) };
  }
  return { declaredSuit: ace ? bestSuit(rest) : null, requestedCard: null };
}

export function shouldDeclareKadi(state: GameState, playerIndex: number): boolean {
  if (state.kadiCalls[playerIndex]) return false;
  const hand = state.hands[playerIndex];
  if (hand.length > 3 || hand.length === 0) return false;
  // Winnable shape: every card is a winning rank (questions need their answer present).
  const answerable = (q: Card): boolean =>
    hand.some((a) => a.id !== q.id && isWinningRank(a.rank, state.config) && a.suit === q.suit);
  return hand.every((c) =>
    isWinningRank(c.rank, state.config) ||
    (state.config.questionRanks.includes(c.rank) && answerable(c)),
  );
}

export function chooseMove(
  state: GameState,
  playerIndex: number,
  difficulty: Difficulty,
  random: () => number = Math.random,
): BotMove | null {
  const hand = state.hands[playerIndex];

  // 1. Penalty owed: stack (color-family gate) > block > take.
  if (state.pendingPenalty > 0) {
    const answers = legalSingles(state, playerIndex);
    const stacks = answers.filter((c) => c.rank !== 'A');
    if (stacks.length > 0) {
      if (difficulty === 'easy' && random() < 0.35) return null; // easy sometimes eats it
      return { cards: [randomOf(stacks, random)] };
    }
    const aces = answers.filter((c) => c.rank === 'A');
    if (aces.length > 0) {
      const combo = [aces[0]];
      return { cards: combo, ...withDeclarations(state, hand, combo) };
    }
    return null;
  }

  // 2. Skipped: refuse with a Jump if we can (medium+ always, easy sometimes).
  if (state.pendingSkip > 0) {
    const jumps = hand.filter((c) => validateCombo([c], state, playerIndex).ok);
    if (jumps.length > 0 && (difficulty !== 'easy' || random() < 0.5)) {
      return { cards: [randomOf(jumps, random)] };
    }
    return null;
  }

  // 2b. Reversed: refuse with a Kickback if we can (medium+ always, easy sometimes).
  if ((state.pendingReverse ?? 0) > 0) {
    const kicks = hand.filter((c) => validateCombo([c], state, playerIndex).ok);
    if (kicks.length > 0 && (difficulty !== 'easy' || random() < 0.5)) {
      return { cards: [randomOf(kicks, random)] };
    }
    return null;
  }

  // 3. Exact-card request outstanding: exact card > Ace downgrade > draw.
  if (state.activeCardRequest) {
    const req = state.activeCardRequest;
    const exact = hand.find((c) => c.rank === req.rank && c.suit === req.suit);
    if (exact && validateCombo([exact], state, playerIndex).ok) {
      return { cards: [exact] };
    }
    const downgrades = legalSingles(state, playerIndex).filter((c) => c.rank === 'A');
    if (downgrades.length > 0) {
      const combo = [downgrades[0]];
      return { cards: combo, ...withDeclarations(state, hand, combo) };
    }
    return null;
  }

  const singles = legalSingles(state, playerIndex);
  const qCombos = questionCombos(state, playerIndex);
  const pairs = difficulty === 'easy' ? [] : pairCombos(state, playerIndex);

  if (difficulty === 'easy') {
    const options: Card[][] = [...singles.map((s) => [s]), ...qCombos];
    if (options.length === 0) return null;
    const pick = randomOf(options, random);
    return { cards: pick, ...withDeclarations(state, hand, pick) };
  }

  // medium + hard: shed the most cards, prefer attacks when a rival is close to winning.
  const top = topCard(state);
  void top;
  const allOptions: Card[][] = [...qCombos, ...pairs, ...singles.map((s) => [s])];
  if (allOptions.length === 0) return null;

  const rivalClose = state.hands.some((h, i) => i !== playerIndex && h.length <= 2);

  const score = (combo: Card[]): number => {
    let s = combo.length * 10;
    const last = combo[combo.length - 1];
    if (isPenaltyRank(last.rank, state.config) && rivalClose) s += difficulty === 'hard' ? 12 : 6;
    if (isSuperAceCombo(combo, state) && rivalClose) s += difficulty === 'hard' ? 10 : 5;
    // Asking bare costs cards — prefer answering; easy bots don't care.
    if (comboLeavesQuestionOpen(combo, state)) s -= difficulty === 'hard' ? 8 : 5;
    if (last.rank === 'A') s -= 4; // save Aces for defence (hard saves harder)
    if (isWinningRank(last.rank, state.config)) s += difficulty === 'hard' ? 3 : 1;
    if (combo.length === 1 && state.config.questionRanks.includes(combo[0].rank)) s -= 5;
    return s + random() * 2;
  };

  let best = allOptions[0];
  let bestScore = -Infinity;
  for (const combo of allOptions) {
    const sc = score(combo);
    if (sc > bestScore) {
      bestScore = sc;
      best = combo;
    }
  }
  return { cards: best, ...withDeclarations(state, hand, best) };
}
