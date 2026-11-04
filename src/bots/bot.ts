import type { Card, Suit } from '../engine/cards';
import { isJumpRank, isKickbackRank, isPenaltyRank, isWinningRank } from '../engine/rules';
import { isAceAnswerCombo, isSuperAceCombo, comboLeavesQuestionOpen, canCallKadi, canDeclareKadi, canDumpWinningNow, canFinishNow, canHandFinishInOnePlay, isKadiLocked, legalSingles, validateCombo, winningDumpOrder } from '../engine/validator';
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

/** Two-card combos closing with an answer (Q + same-suit answer, or Q + Ace any suit). */
function questionCombos(state: GameState, playerIndex: number): Card[][] {
  const hand = state.hands[playerIndex];
  const combos: Card[][] = [];
  for (const q of hand) {
    // Lone questions are legal (draw obligation), so always look for a closing answer.
    for (const a of hand) {
      if (a.id === q.id) continue;
      const aceAnswer = a.rank === 'A' && state.config.aceAnswersQuestion !== false;
      if (!aceAnswer && !isWinningRank(a.rank, state.config)) continue;
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
  // An Ace answering a question never declares — suit auto-follows the Ace.
  if (isAceAnswerCombo(combo, state)) {
    return { declaredSuit: null, requestedCard: null };
  }
  const ace = combo.find((c) => c.rank === 'A');
  const rest = hand.filter((h) => !combo.some((p) => p.id === h.id));
  if (isSuperAceCombo(combo, state)) {
    return { declaredSuit: null, requestedCard: chooseRequestCard(rest.length > 0 ? rest : hand) };
  }
  return { declaredSuit: ace ? bestSuit(rest) : null, requestedCard: null };
}

/** A seat is a live threat whenever it has an active KADI call and cards left. */
export function isDeclaredThreat(state: GameState, playerIndex: number): boolean {
  return state.kadiCalls[playerIndex] === true && state.hands[playerIndex].length > 0;
}

/**
 * A non-winning setup the bot can play on its call turn without emptying the
 * hand or leaving a question open, and that leaves the rest of the hand able
 * to finish in one legal play. Without one, calling would strand the claim.
 */
export function hasSetupMove(state: GameState, playerIndex: number): boolean {
  const hand = state.hands[playerIndex];
  if (hand.length < 2) return false;
  const options: Card[][] = [
    ...legalSingles(state, playerIndex).map((c) => [c]),
    ...questionCombos(state, playerIndex),
    ...pairCombos(state, playerIndex),
  ];
  return options.some((cards) => {
    if (cards.length >= hand.length) return false;
    if (comboLeavesQuestionOpen(cards, state)) return false;
    const rest = hand.filter((h) => !cards.some((c) => c.id === h.id));
    return canHandFinishInOnePlay(rest, state);
  });
}

/**
 * Bot call policy. This is a decision, not a rule: the bot uses the same
 * checked declaration path as the human (`tryDeclareKadi`), so a call is
 * legal only when the hand can eventually go out in one play. A ready call
 * is taken (Easy sometimes hesitates); an early call stakes the claim before
 * the table opens, with difficulty controlling the appetite for that risk.
 * The bot only calls when it also has a setup that keeps the hand winnable,
 * because every opponent must now take a turn before the claim can mature.
 */
export function shouldDeclareKadi(
  state: GameState,
  playerIndex: number,
  difficulty: Difficulty = 'medium',
  random: () => number = Math.random,
): boolean {
  if (!canDeclareKadi(state, playerIndex) || isKadiLocked(state, playerIndex)) {
    return false;
  }
  // Same false-call gate as the human: the hand must be able to finish in one
  // legal winning play, even if the current table does not allow it yet.
  if (!canCallKadi(state, playerIndex)) return false;
  // A claim is a promise to survive a full round. Without a safe setup the
  // bot would be forced to pick (and void the claim) before it matures.
  if (!hasSetupMove(state, playerIndex)) return false;
  if (canDumpWinningNow(state, playerIndex)) {
    return difficulty !== 'easy' || random() < 0.6;
  }
  const earlyCallChance =
    difficulty === 'hard' ? 0.65 : difficulty === 'medium' ? 0.35 : 0.15;
  return random() < earlyCallChance;
}

export function chooseMove(
  state: GameState,
  playerIndex: number,
  difficulty: Difficulty,
  random: () => number = Math.random,
): BotMove | null {
  const hand = state.hands[playerIndex];
  const claimActive = state.kadiCalls[playerIndex] === true;

  // A non-winning move must never empty the hand: it would strand a KADI
  // claim or make the bot cardless. Step 0 takes the legal win instead.
  const safe = (cards: Card[]): BotMove | null => {
    if (cards.length >= hand.length) return null;
    return { cards, ...withDeclarations(state, hand, cards) };
  };

  // While a claim is live, a setup must leave a hand that can still finish in
  // one legal play; otherwise the claim is already dead and picking is safer.
  const preservesClaim = (combo: Card[]): boolean => {
    if (!claimActive) return true;
    const rest = hand.filter((h) => !combo.some((c) => c.id === h.id));
    return canHandFinishInOnePlay(rest, state);
  };

  // 0. A call that has survived every opponent plus a whole-hand winner.
  if (canFinishNow(state, playerIndex)) {
    const winningDump = winningDumpOrder(state, playerIndex);
    if (winningDump) {
      return { cards: winningDump, ...withDeclarations(state, hand, winningDump) };
    }
  }

  // 1. Penalty owed: stack (color-family gate) > block > take.
  if (state.pendingPenalty > 0) {
    const answers = legalSingles(state, playerIndex);
    const stacks = answers.filter((c) => c.rank !== 'A');
    if (stacks.length > 0) {
      if (difficulty === 'easy' && random() < 0.35) return null; // easy sometimes eats it
      return safe([randomOf(stacks, random)]);
    }
    const aces = answers.filter((c) => c.rank === 'A');
    if (aces.length > 0) {
      return safe([aces[0]]);
    }
    return null;
  }

  // 2. Skipped: refuse with a Jump if we can (medium+ always, easy sometimes).
  if (state.pendingSkip > 0) {
    const jumps = hand.filter((c) => validateCombo([c], state, playerIndex).ok);
    if (jumps.length > 0 && (difficulty !== 'easy' || random() < 0.5)) {
      return safe([randomOf(jumps, random)]);
    }
    return null;
  }

  // 2b. Reversed: refuse with a Kickback if we can (medium+ always, easy sometimes).
  if ((state.pendingReverse ?? 0) > 0) {
    const kicks = hand.filter((c) => validateCombo([c], state, playerIndex).ok);
    if (kicks.length > 0 && (difficulty !== 'easy' || random() < 0.5)) {
      return safe([randomOf(kicks, random)]);
    }
    return null;
  }

  // 3. Exact-card request outstanding: exact card > Ace downgrade > super-ace
  // redeclare > draw (demand persists, next player faces same demand).
  if (state.activeCardRequest) {
    const req = state.activeCardRequest;
    const exact = hand.find((c) => c.rank === req.rank && c.suit === req.suit);
    if (exact && validateCombo([exact], state, playerIndex).ok) {
      return safe([exact]);
    }
    const downgrades = legalSingles(state, playerIndex).filter((c) => c.rank === 'A');
    if (downgrades.length > 0) {
      return safe([downgrades[0]]);
    }
    // Super ace redeclare: 2+ aces (or special ace alone with mode on)
    // replaces the demand with a fresh suit + rank.
    const aces = hand.filter((c) => c.rank === 'A');
    if (aces.length >= state.config.superAceMinAces) {
      const combo = aces.slice(0, state.config.superAceMinAces);
      if (validateCombo(combo, state, playerIndex).ok) {
        return safe(combo);
      }
    }
    if (state.config.superAceEnabled && aces.length >= 1) {
      const special = aces.find((c) => c.suit === state.config.specialAceSuit);
      if (special && validateCombo([special], state, playerIndex).ok) {
        return safe([special]);
      }
    }
    return null;
  }

  const singles = legalSingles(state, playerIndex);
  const qCombos = questionCombos(state, playerIndex);
  const pairs = difficulty === 'easy' ? [] : pairCombos(state, playerIndex);

  // Table heat: anyone short OR anyone who declared KADI paints a target,
  // exactly like friends consulting to stop the winner. declarerNext is the
  // seat that would act right after this bot (direction-aware).
  const n = state.hands.length;
  const nextSeat = (playerIndex + state.direction + n) % n;
  const declarerNext =
    nextSeat !== playerIndex && isDeclaredThreat(state, nextSeat);
  const anyDeclarer = state.hands.some((_, i) => i !== playerIndex && isDeclaredThreat(state, i));
  const rivalClose =
    state.hands.some((h, i) => i !== playerIndex && h.length <= 2) || anyDeclarer;

  const isAttack = (combo: Card[]): boolean => {
    const last = combo[combo.length - 1];
    if (isPenaltyRank(last.rank, state.config)) return true;
    if (isSuperAceCombo(combo, state)) return true;
    if (combo.some((c) => isJumpRank(c.rank, state.config))) return true;
    if (combo.some((c) => isKickbackRank(c.rank, state.config))) return true;
    return false;
  };

  if (difficulty === 'easy') {
    const options: Card[][] = [...singles.map((s) => [s]), ...qCombos]
      .filter((combo) => combo.length < hand.length)
      .filter((combo) => !claimActive || !comboLeavesQuestionOpen(combo, state))
      .filter(preservesClaim);
    if (options.length === 0) return null;
    // Easy still pressures a declarer next to act, just less reliably.
    if (declarerNext) {
      const attacks = options.filter(isAttack);
      if (attacks.length > 0 && random() < 0.6) {
        return safe(randomOf(attacks, random));
      }
    }
    return safe(randomOf(options, random));
  }

  // medium + hard: shed the most cards, prefer attacks when a rival is close to winning.
  const top = topCard(state);
  void top;
  const allOptions: Card[][] = [...qCombos, ...pairs, ...singles.map((s) => [s])]
    .filter((combo) => combo.length < hand.length)
    .filter((combo) => !claimActive || !comboLeavesQuestionOpen(combo, state))
    .filter(preservesClaim);
  if (allOptions.length === 0) return null;

  const score = (combo: Card[]): number => {
    let s = combo.length * 10;
    const last = combo[combo.length - 1];
    if (isPenaltyRank(last.rank, state.config) && rivalClose) s += difficulty === 'hard' ? 12 : 6;
    if (isSuperAceCombo(combo, state) && rivalClose) s += difficulty === 'hard' ? 10 : 5;
    // Hunting bonus: routing or hitting the declarer next to act.
    if (declarerNext && isAttack(combo)) s += difficulty === 'hard' ? 8 : 4;
    // Asking bare costs cards — prefer answering; easy bots don't care.
    if (comboLeavesQuestionOpen(combo, state)) s -= difficulty === 'hard' ? 8 : 5;
    const aceClosesQuestion =
      last.rank === 'A' &&
      state.config.aceAnswersQuestion !== false &&
      combo.some((c) => c.rank !== 'A' && state.config.questionRanks.includes(c.rank)) &&
      !comboLeavesQuestionOpen(combo, state);
    if (aceClosesQuestion) s += difficulty === 'hard' ? 3 : 1;
    else if (last.rank === 'A') s -= 4; // save Aces for defence (hard saves harder)
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
  return safe(best);
}
