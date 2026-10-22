import type { Card, Suit } from './cards';
import {
  isJumpRank, isKickbackRank, isPenaltyRank, isQuestionRank, isWinningRank,
  type RulesConfig,
} from './rules';
import { advanceTurn, drawCards, topCard, type GameState } from './state';

export type InvalidReason =
  | 'NOT_YOUR_TURN' | 'CARD_NOT_IN_HAND' | 'GAME_OVER'
  | 'NO_MATCH' | 'QUESTION_NEEDS_ANSWER' | 'PENALTY_MUST_STACK_OR_BLOCK'
  | 'ACE_ONLY_STACKS_WITH_ACE' | 'MUST_BE_SAME_RANK'
  | 'SKIP_MUST_COUNTER_OR_ACCEPT' | 'REVERSE_MUST_COUNTER_OR_ACCEPT' | 'CANNOT_WIN_YET' | 'UNMET_REQUEST';

export interface ComboCheck {
  ok: boolean;
  reason?: InvalidReason;
}

/**
 * Single card matches top? Handles Ace-declared suit.
 * A Joker is never a free play, only a pending 2/3 (or Joker) takes it
 * (see validateVsTable). A Joker on top with no live debt and no active
 * suit (legacy saves only) still lets anything through to avoid deadlock.
 */
export function singleMatchesTop(card: Card, state: GameState): boolean {
  const top = topCard(state);
  // Ace / Joker-eat declared a suit: follow it (or re-Ace), even under a Joker top.
  if (state.activeSuit) {
    if (card.rank === 'A') return true;
    return card.suit === state.activeSuit;
  }
  // After a Joker with no suit to follow, anything goes (prevents deadlock).
  if (top.rank === 'JOKER') return true;
  // Ace is wild (request), always playable.
  if (card.rank === 'A') return true;
  return card.suit === top.suit || card.rank === top.rank;
}

function isTwoPlayer(state: GameState): boolean {
  return state.hands.length === 2;
}

function jumpActsAsQuestion(state: GameState): boolean {
  return isTwoPlayer(state) && state.config.twoPlayerJumpAsQuestion;
}

function kickbackActsAsQuestion(state: GameState): boolean {
  return isTwoPlayer(state) && state.config.twoPlayerKickbackAsQuestion;
}

function suitGlyph(suit: Suit): string {
  return suit === 'hearts' ? '♥' : suit === 'diamonds' ? '♦' : suit === 'spades' ? '♠' : '♣';
}

/** Normalise a card suit for memory fields (Joker tops carry no suit). */
function suitOrNull(suit: Card['suit']): Suit | null {
  return suit === 'none' ? null : suit;
}

function rankNeedsAnswer(rank: Card['rank'], state: GameState): boolean {
  if (isQuestionRank(rank, state.config)) return true;
  if (isJumpRank(rank, state.config) && jumpActsAsQuestion(state)) return true;
  if (isKickbackRank(rank, state.config) && kickbackActsAsQuestion(state)) return true;
  return false;
}

/**
 * A combo qualifies as a SUPER ace (exact-card request) when it holds the
 * special ace alone with the mode on, or reaches the stacked-ace count —
 * stacked aces are inherently super, no toggle needed.
 */
export function isSuperAceCombo(cards: Card[], state: GameState): boolean {
  const { config } = state;
  const aces = cards.filter((c) => c.rank === 'A');
  if (aces.length === 0 || aces.length !== cards.length) return false;
  if (aces.length >= config.superAceMinAces) return true;
  return (
    aces.length === 1 &&
    config.superAceEnabled &&
    aces[0].suit === config.specialAceSuit
  );
}

/**
 * Penalty-family answer check. Only penalty cards (2/3/Joker) or an Ace
 * may answer a pending penalty. J/K are never penalties (see dodge rule).
 * Matching is governed by `penaltyMatchMode`:
 * - 'any' (Bom ni Bom): any penalty answers any other, no suit/rank check.
 * - 'sameRank': same rank only (2♣ on 2♥, JOKER on JOKER).
 * - 'family' (default): a Joker answers any 2/3, unrestricted by suit or
 *   color; a Joker on top is relaxed only by another Joker or an Ace, even
 *   a same-suit 2/3 is illegal, eat or block; 2/3 on 2/3: same rank any
 *   suit, or same suit any penalty rank.
 * rememberedSuit is kept for post-eat suit continuation (eat a Joker and
 * play follows the suit before it), not for answering. It is null only
 * for pre-memory saves, which stay free-play after the eat.
 */
export function penaltyAnswerOk(
  card: Card,
  table: Card,
  config: RulesConfig,
  _rememberedSuit: Suit | null = null,
): boolean {
  if (card.rank === 'A') return config.aceBlocksPenalty;
  if (!isPenaltyRank(card.rank, config)) return false;
  if (!config.allowPenaltyStacking) return false;
  const mode = config.penaltyMatchMode ?? 'family';
  if (mode === 'any') return true;
  if (mode === 'sameRank') return card.rank === table.rank;
  if (card.rank === 'JOKER') return true;
  if (table.rank === 'JOKER') {
    return false;
  }
  return card.rank === table.rank || card.suit === table.suit;
}

/** Penalty cards (2/3/Joker) never mix with normal cards in one combo. */
function mixesPenaltyWithNormal(cards: Card[], config: RulesConfig): boolean {
  return (
    cards.some((c) => isPenaltyRank(c.rank, config)) &&
    !cards.every((c) => isPenaltyRank(c.rank, config))
  );
}

/** An Ace answers any open question regardless of suit (Q♠ + A♦ is legal). Missing flag defaults to true. */
export function isAceAnswer(card: Card, config: RulesConfig): boolean {
  return card.rank === 'A' && config.aceAnswersQuestion !== false;
}

/**
 * True when the combo uses an Ace to answer a question (Q/8 or 2P J/K):
 * it holds a question and an Ace, and every Ace closes an open question.
 * All-Ace stacks (super demands) never count, answering never affects
 * the 2-ace combination rules.
 */
export function isAceAnswerCombo(cards: Card[], state: GameState): boolean {
  if (state.config.aceAnswersQuestion === false) return false;
  if (!cards.some((c) => c.rank === 'A')) return false;
  if (!cards.some((c) => rankNeedsAnswer(c.rank, state))) return false;
  return !mixesAceWithNonAce(cards, state);
}

/**
 * An Ace plays solo or stacks only with other Aces, except as a
 * question answer: every Ace must close an open question (Q/8 or 2P J/K).
 * Q + A (any suit) is legal; A + 10 and lone-A-after-answer mixes stay illegal.
 */
function mixesAceWithNonAce(cards: Card[], state: GameState): boolean {
  if (!cards.some((c) => c.rank === 'A')) return false;
  if (cards.every((c) => c.rank === 'A')) return false;
  if (state.config.aceAnswersQuestion === false) return true;
  let open = false;
  for (const c of cards) {
    if (rankNeedsAnswer(c.rank, state)) {
      open = true;
      continue;
    }
    if (c.rank === 'A') {
      if (!open) return true;
      open = false;
      continue;
    }
    if (isWinningRank(c.rank, state.config)) {
      if (open) open = false;
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Free-play combo shape: every card shares one rank (first matches the top,
 * rest match rank, any suit), J stacks only with J, K only with K, and a
 * question opens a Q/8 chain: questions may stack on questions, winning
 * answers (4 5 6 7 9 10) close the currently open question and must match
 * its suit, while an Ace closes any open question regardless of suit.
 * Returns a rejection, or null when the shape is acceptable
 * (suit/rank chaining and question closure are validated separately).
 */
function checkComboShape(cards: Card[], state: GameState): ComboCheck | null {
  const { config } = state;
  const allSameRank = cards.every((c) => c.rank === cards[0].rank);
  const hasJump = cards.some((c) => isJumpRank(c.rank, config));
  const hasKick = cards.some((c) => isKickbackRank(c.rank, config));
  if (hasJump && hasKick) {
    return { ok: false, reason: 'MUST_BE_SAME_RANK' };
  }
  const questionLed = rankNeedsAnswer(cards[0].rank, state);
  if (!allSameRank && !questionLed) {
    return { ok: false, reason: 'MUST_BE_SAME_RANK' };
  }
  if (questionLed && !allSameRank) {
    let open: Card | null = cards[0];
    for (const c of cards.slice(1)) {
      if (rankNeedsAnswer(c.rank, state)) {
        open = c;
        continue;
      }
      if (isAceAnswer(c, config)) {
        open = null;
        continue;
      }
      if (!isWinningRank(c.rank, config)) return { ok: false, reason: 'MUST_BE_SAME_RANK' };
      if (config.mustAnswerSameSuit && open && c.suit !== open.suit) {
        return { ok: false, reason: 'MUST_BE_SAME_RANK' };
      }
      open = null;
    }
  }
  return null;
}

/**
 * Bom ni Bom dodge: a single J or K played onto a pending penalty passes the
 * unchanged debt onward. Never a penalty, never adds picks, never stacks.
 * J/K stay jump/reverse cards, they never count as penalties.
 */
export function isPenaltyDodge(cards: Card[], state: GameState): boolean {
  const { config } = state;
  if (!config.dodgePenaltyWithJumpKickback) return false;
  if (state.pendingPenalty <= 0) return false;
  if (cards.length !== 1) return false;
  const rank = cards[0].rank;
  if (cards.some((c) => c.rank === 'A')) return false;
  if (cards.some((c) => isPenaltyRank(c.rank, config))) return false;
  return isJumpRank(rank, config) || isKickbackRank(rank, config);
}

/** Chained cards must connect to previous by suit-or-rank (Ace/Joker wild connect). */
function validateChainLinks(cards: Card[]): ComboCheck {
  for (let i = 1; i < cards.length; i++) {
    const prev = cards[i - 1];
    const cur = cards[i];
    const connects =
      cur.rank === 'A' || cur.rank === 'JOKER' ||
      cur.suit === prev.suit || cur.rank === prev.rank;
    if (!connects) return { ok: false, reason: 'NO_MATCH' };
  }
  return { ok: true };
}

/** Scan a combo for a question-like card left without an answer after it. */
function findOpenQuestion(cards: Card[], state: GameState): Card | null {
  const { config } = state;
  let openQuestion: Card | null = null;
  for (const c of cards) {
    if (openQuestion) {
      // An Ace closes any open question regardless of suit.
      if (isAceAnswer(c, config)) {
        openQuestion = null;
        continue;
      }
      const isAnswer = isWinningRank(c.rank, config);
      if (!isAnswer) {
        // stacking another question is fine, still open
        if (rankNeedsAnswer(c.rank, state)) {
          openQuestion = c;
          continue;
        }
        return openQuestion;
      }
      if (config.mustAnswerSameSuit && c.suit !== openQuestion.suit) {
        return openQuestion;
      }
      openQuestion = null;
      continue;
    }
    if (rankNeedsAnswer(c.rank, state)) openQuestion = c;
  }
  return openQuestion;
}

/**
 * True when the combo asks a question without closing it with an answer.
 * Always legal to play, the obligation is to draw, enforced in playCombo.
 */
export function comboLeavesQuestionOpen(cards: Card[], state: GameState): boolean {
  return findOpenQuestion(cards, state) != null;
}
/**
 * Validate a combo played together (e.g. Q♥ + 5♥, or 8♠ + 8♥ + 4♥).
 * Rules: first card must match top (or satisfy an exact-card request);
 * chained cards must match each other by suit-or-rank; every question-like
 * card must be closed by an answer.
 */
export function validateCombo(cards: Card[], state: GameState, playerIndex: number): ComboCheck {
  if (state.gameOver) return { ok: false, reason: 'GAME_OVER' };
  if (playerIndex !== state.currentPlayer) return { ok: false, reason: 'NOT_YOUR_TURN' };
  if (cards.length === 0) return { ok: false, reason: 'CARD_NOT_IN_HAND' };

  const hand = state.hands[playerIndex];
  for (const c of cards) {
    if (!hand.some((h) => h.id === c.id)) return { ok: false, reason: 'CARD_NOT_IN_HAND' };
  }

  return validateVsTable(cards, state);
}

/** Table legality of a combo, ignoring whose turn it is (powers capability search). */
function validateVsTable(cards: Card[], state: GameState): ComboCheck {
  const { config } = state;

  // Pending skip: only a single counter-Jump (any J) against a single skip,
  // or accept-skip, is legal. Stacks are unrefusable.
  if (state.pendingSkip > 0) {
    if (!config.jumpCounterable) return { ok: false, reason: 'SKIP_MUST_COUNTER_OR_ACCEPT' };
    const singleRefusal =
      cards.length === 1 && state.pendingSkip === 1 && isJumpRank(cards[0].rank, config);
    if (!singleRefusal) return { ok: false, reason: 'SKIP_MUST_COUNTER_OR_ACCEPT' };
    return { ok: true };
  }

  // Pending reversal: only a single counter-Kickback (any K) against a single
  // reversal, or accept, is legal. Stacks are unrefusable.
  if ((state.pendingReverse ?? 0) > 0) {
    if (!config.kickbackCounterable) return { ok: false, reason: 'REVERSE_MUST_COUNTER_OR_ACCEPT' };
    const singleRefusal =
      cards.length === 1 && (state.pendingReverse ?? 0) === 1 && isKickbackRank(cards[0].rank, config);
    if (!singleRefusal) return { ok: false, reason: 'REVERSE_MUST_COUNTER_OR_ACCEPT' };
    return { ok: true };
  }

  // Pending penalty: only penalty-family answers, Ace block, or Bom ni Bom dodge.
  if (state.pendingPenalty > 0) {
    const table = topCard(state);
    const hasAce = cards.some((c) => c.rank === 'A');
    if (hasAce) {
      // Ace block must be aces-only (stacked aces may also carry a super request).
      if (!cards.every((c) => c.rank === 'A')) {
        return { ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' };
      }
      if (!config.aceBlocksPenalty) return { ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' };
      return { ok: true };
    }
    if (cards.length === 0) return { ok: false, reason: 'CARD_NOT_IN_HAND' };
    // Dodge passes the unchanged debt onward, no penalty semantics.
    if (isPenaltyDodge(cards, state)) return { ok: true };
    if (!isPenaltyRank(cards[0].rank, config) || !penaltyAnswerOk(cards[0], table, config, state.pendingPenaltySuit)) {
      return { ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' };
    }
    // Every stacked card must itself be a penalty card (no sneaking in answers).
    // Mixed stacks keep chain-first reasons (e.g. Joker + normal → NO_MATCH).
    if (!cards.every((c) => isPenaltyRank(c.rank, config))) {
      const links = validateChainLinks(cards);
      if (!links.ok) return links;
      return { ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' };
    }
    // All-penalty stacks chain per the active match mode, except 'any'
    // (Bom ni Bom), which accepts cross-rank/cross-suit stacks outright.
    // Other modes keep the generic chain check first so rejection reasons
    // match the pre-mode behavior, then enforce the mode per card.
    if (config.penaltyMatchMode !== 'any') {
      const links = validateChainLinks(cards);
      if (!links.ok) return links;
    }
    for (let i = 1; i < cards.length; i++) {
      if (!penaltyAnswerOk(cards[i], cards[i - 1], config)) {
        return { ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' };
      }
    }
    return { ok: true };
  }

  // Exact-card request (super ace) outstanding: exact card or an Ace (downgrade).
  if (state.activeCardRequest) {
    const first = cards[0];
    const req = state.activeCardRequest;
    const isExact = first.rank === req.rank && first.suit === req.suit;
    const isAce = first.rank === 'A';
    if (!isExact && !isAce) return { ok: false, reason: 'UNMET_REQUEST' };
    if (mixesAceWithNonAce(cards, state)) {
      return { ok: false, reason: 'ACE_ONLY_STACKS_WITH_ACE' };
    }
    if (mixesPenaltyWithNormal(cards, config)) {
      return { ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' };
    }
    const shapeReq = checkComboShape(cards, state);
    if (shapeReq) return shapeReq;
    const links = validateChainLinks(cards);
    if (!links.ok) return links;
    // An unanswered question here is legal too, draw obligation applies.
    return { ok: true };
  }

  // Normal: first card matches top.
  if (!singleMatchesTop(cards[0], state)) return { ok: false, reason: 'NO_MATCH' };

  // All-penalty combos stack per the active match mode (same rule as answering
  // a debt), so 'sameRank' rejects suited cross-rank stacks and 'any' accepts
  // cross-rank/cross-suit stacks even as free play.
  if (cards.length > 1 && cards.every((c) => isPenaltyRank(c.rank, config))) {
    for (let i = 1; i < cards.length; i++) {
      if (!penaltyAnswerOk(cards[i], cards[i - 1], config)) {
        return { ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' };
      }
    }
    return { ok: true };
  }

  // An Ace plays solo or with Aces only, except as a question answer
  // (Q + A any suit is legal). A + 10 is never a combo, even suited.
  if (mixesAceWithNonAce(cards, state)) {
    return { ok: false, reason: 'ACE_ONLY_STACKS_WITH_ACE' };
  }
  // A penalty card only stacks with other penalties, never with normal cards,
  // even when the suits connect. Eat the debt first, then resume normal play.
  if (mixesPenaltyWithNormal(cards, config)) {
    return { ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' };
  }
  // Same-rank stacks (questions take same-suit answers or any Ace).
  const shape = checkComboShape(cards, state);
  if (shape) return shape;
  const links = validateChainLinks(cards);
  if (!links.ok) return links;
  // An unanswered question is legal, the obligation is to draw (see playCombo),
  // never a blocked move.
  return { ok: true };
}

/** All legal single-card moves for UI hints + Easy bots. */
export function legalSingles(state: GameState, playerIndex: number): Card[] {
  const hand = state.hands[playerIndex];
  return hand.filter((c) => validateCombo([c], state, playerIndex).ok);
}

function comboIsWinningOnly(cards: Card[], state: GameState): boolean {
  // Final dump must end "clean": a winning rank, or an Ace answering a
  // question (Q + A any suit). Lone Aces, J/K and penalties can never close.
  // Must-end-on-one tables only accept a lone single card as the closer.
  if (state.config.winningDumpMustBeSingle && cards.length !== 1) return false;
  const last = cards[cards.length - 1];
  if (isWinningRank(last.rank, state.config)) return true;
  if (isAceAnswer(last, state.config)) {
    // Ace wins only as a question answer: the combo must hold a question
    // and leave nothing open (validated by caller for legality).
    if (!cards.some((c) => rankNeedsAnswer(c.rank, state))) return false;
    return comboLeavesQuestionOpen(cards, state) === false;
  }
  return false;
}

/** Heap's algorithm; visit returns true to stop early. */
function eachPermutation<T>(arr: T[], visit: (order: T[]) => boolean): void {
  const a = [...arr];
  const n = a.length;
  if (n === 0) return;
  const c = new Array<number>(n).fill(0);
  if (visit(a)) return;
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      if (i % 2 === 0) {
        [a[0], a[i]] = [a[i], a[0]];
      } else {
        [a[c[i]], a[i]] = [a[i], a[c[i]]];
      }
      if (visit(a)) return;
      c[i] += 1;
      i = 0;
    } else {
      c[i] = 0;
      i += 1;
    }
  }
}

/** Largest hand that gets an exact finish/call search (7! = 5040 checks worst case). */
const FINISH_SEARCH_CAP = 7;

export function kadiRequired(config: RulesConfig): boolean {
  return config.mustSayNikoKadi !== false;
}

/** The call itself is valid; a same-turn call is enough (the dump follows it). */
export function hasValidKadiCall(state: GameState, playerIndex: number): boolean {
  return !kadiRequired(state.config) || state.kadiCalls[playerIndex] === true;
}

export function isKadiLocked(state: GameState, playerIndex: number): boolean {
  return state.kadiFalseCalls?.[playerIndex] === true;
}

/**
 * A structurally legal winning dump for a future table: the whole hand can
 * be ordered into one winning-only combo, ignoring the current top card.
 * Questions may stack; a stacked question only needs its final answer.
 */
function structurallyWinning(cards: Card[], state: GameState): boolean {
  if (cards.length === 0) return false;
  const { config } = state;
  if (config.winningDumpMustBeSingle && cards.length !== 1) return false;
  if (mixesAceWithNonAce(cards, state)) return false;
  if (mixesPenaltyWithNormal(cards, config)) return false;
  if (checkComboShape(cards, state)) return false;
  if (!validateChainLinks(cards).ok) return false;
  if (comboLeavesQuestionOpen(cards, state)) return false;
  return comboIsWinningOnly(cards, state);
}

/**
 * Can this hand be declared? This is the false-call check and the early-call
 * check: it answers "could these cards ever go out in one legal winning move"
 * without looking at the current table. The current-table win uses
 * `canDumpWinningNow` instead.
 */
export function canCallKadi(state: GameState, playerIndex: number): boolean {
  if (state.gameOver) return false;
  const hand = state.hands[playerIndex];
  if (!hand || hand.length === 0 || hand.length > FINISH_SEARCH_CAP) return false;
  if (state.config.winningDumpMustBeSingle && hand.length !== 1) return false;
  let capable = false;
  eachPermutation(hand, (perm) => {
    if (structurallyWinning(perm, state)) {
      capable = true;
      return true;
    }
    return false;
  });
  return capable;
}

/**
 * Find an order that dumps the entire hand in one winning move against the
 * current table, ignoring whether the player called. Used by bots to take
 * the same-turn win and by the pre-call finish cue; `canFinishNow` adds the
 * call requirement for the live threat badge.
 */
export function winningDumpOrder(state: GameState, playerIndex: number): Card[] | null {
  const { config } = state;
  if (state.gameOver) return null;
  const hand = state.hands[playerIndex];
  if (!hand || hand.length === 0 || hand.length > FINISH_SEARCH_CAP) return null;
  // Penalty/skip/reversal debts must be answered first, and their answers can never close.
  if (state.pendingPenalty > 0 || state.pendingSkip > 0 || (state.pendingReverse ?? 0) > 0) return null;
  if (config.cardlessBlocksWin && state.hands.some((h, i) => i !== playerIndex && h.length === 0)) return null;
  // Must-end-on-one tables only win from a lone last card.
  if (config.winningDumpMustBeSingle && hand.length !== 1) return null;
  // The closer must be a winning rank or an Ace-answering-question.
  if (!hand.some((c) => isWinningRank(c.rank, config) || isAceAnswer(c, config))) return null;

  let found: Card[] | null = null;
  eachPermutation(hand, (perm) => {
    const last = perm[perm.length - 1];
    const closerOk = isWinningRank(last.rank, config) || isAceAnswer(last, config);
    if (!closerOk) return false;
    if (!validateVsTable(perm, state).ok) return false;
    if (comboLeavesQuestionOpen(perm, state)) return false;
    if (comboIsWinningOnly(perm, state)) {
      found = [...perm];
      return true;
    }
    return false;
  });
  return found;
}

export function canDumpWinningNow(state: GameState, playerIndex: number): boolean {
  return winningDumpOrder(state, playerIndex) !== null;
}

/**
 * Live threat check for the KADI! badge: the player has a valid call and can
 * dump their entire hand in one legal, winning-only combo against the current
 * table. Anything else (debt to answer, undeclared on a call table, cardless
 * blocker, oversized hand) reads as not-finishable.
 */
export function canFinishNow(state: GameState, playerIndex: number): boolean {
  return hasValidKadiCall(state, playerIndex) && canDumpWinningNow(state, playerIndex);
}

export function canDeclareKadi(state: GameState, playerIndex: number): boolean {
  if (!kadiRequired(state.config)) return false;
  if (state.gameOver || state.hands[playerIndex].length === 0) return false;
  return !state.kadiCalls[playerIndex];
}

export function declareKadi(state: GameState, playerIndex: number): boolean {
  if (!canDeclareKadi(state, playerIndex)) return false;
  state.kadiCalls[playerIndex] = true;
  state.kadiCallTurn[playerIndex] = state.turnNumber;
  state.lastEffect = playerIndex === 0 ? 'You are KADI! Go out now!' : `Player ${playerIndex + 1} is KADI! Stop them!`;
  return true;
}

export interface DeclareResult {
  ok: boolean;
  /** Cards drawn on a false call (0 when the call was legal or rejected free). */
  fined?: number;
  /** True when the press was a mistimed call with no winnable hand. */
  falseCall?: boolean;
  /** True when this press is refused because a false call locked the player. */
  locked?: boolean;
}

/**
 * Checked Kadi declaration for UI use (bots keep using
 * shouldDeclareKadi + declareKadi, which is already capability-checked).
 * The buzzer stays pressable anytime, but a press without a legally
 * winnable hand is a false call: no flag is set, the player is fined
 * `falseKadiPickCount` immediately, and the buzzer is locked until their
 * next turn. The turn does NOT advance (calling is a speech act, not a move).
 */
export function tryDeclareKadi(state: GameState, playerIndex: number): DeclareResult {
  if (!canDeclareKadi(state, playerIndex)) return { ok: false };
  if (isKadiLocked(state, playerIndex)) return { ok: false, locked: true };
  if (canCallKadi(state, playerIndex)) {
    declareKadi(state, playerIndex);
    return { ok: true };
  }
  if (!state.kadiFalseCalls) state.kadiFalseCalls = Array(state.hands.length).fill(false);
  state.kadiFalseCalls[playerIndex] = true;
  const owed = state.config.falseKadiPickCount ?? state.config.lateCallPickCount ?? 1;
  if (owed > 0) {
    const drawn = drawCards(state, playerIndex, owed);
    state.lastEffect =
      (state.lastEffect ? state.lastEffect + ' • ' : '') + `False KADI, fined +${drawn.length}`;
    return { ok: false, fined: drawn.length, falseCall: true, locked: true };
  }
  return { ok: false, falseCall: true, locked: true };
}

function winsBlockedByCardless(state: GameState, playerIndex: number): boolean {
  if (!state.config.cardlessBlocksWin) return false;
  return state.hands.some((h, i) => i !== playerIndex && h.length === 0);
}

export interface PlayResult {
  ok: boolean;
  reason?: InvalidReason;
  won?: boolean;
  becameCardless?: boolean;
  fined?: number;
  /** Refusal cleared a skip/reversal debt: the turn stays with the player. */
  keptTurn?: boolean;
}

export function playCombo(
  state: GameState,
  playerIndex: number,
  cards: Card[],
  declaredSuit?: Suit | null,
  requested?: { rank: Card['rank']; suit: Suit } | null,
): PlayResult {
  const check = validateCombo(cards, state, playerIndex);
  if (!check.ok) return { ok: false, reason: check.reason };

  // Was this combo satisfying an exact-card request with the exact card (not an Ace)?
  const req = state.activeCardRequest;
  const satisfiedRequest = req != null && cards[0].rank !== 'A' &&
    cards[0].rank === req.rank && cards[0].suit === req.suit;
  if (satisfiedRequest) state.activeCardRequest = null;

  const isSuper = isSuperAceCombo(cards, state);
  // Top card BEFORE this combo lands, remembers the suit an Ace overrides.
  const prevTop = topCard(state);

  // A Joker takes the suit played before it for post-eat continuation:
  // the card ahead of the first Joker in this combo, else the previous
  // top (Joker chains keep memory). The suit no longer gates answers —
  // only Joker/Ace relax a Joker, but eating still follows it.
  const firstJoker = cards.findIndex((c) => c.rank === 'JOKER');
  if (firstJoker !== -1) {
    const before = firstJoker > 0 ? cards[firstJoker - 1].suit : prevTop.suit;
    if (before !== 'none') state.pendingPenaltySuit = before;
  }

  // Remove from hand, push to discard in order.
  const hand = state.hands[playerIndex];
  for (const c of cards) {
    const idx = hand.findIndex((h) => h.id === c.id);
    hand.splice(idx, 1);
    state.discardPile.push(c);
  }

  const { config } = state;
  let effect: string | null = null;
  // A combo played while a penalty is pending answers it (validate guarantees
  // aces-only here), a pure block that calls nothing further.
  const answersPenalty = state.pendingPenalty > 0;
  // Bom ni Bom dodge: single J/K passes the unchanged debt onward (no picks added).
  const dodgesPenalty = answersPenalty && isPenaltyDodge(cards, state);

  // Which Aces answer an open question in this combo (Q + A any suit).
  // Answering Aces never declare: the suit in force auto-follows the Ace's
  // own suit, like a penalty block calls nothing. All-Ace stacks (super
  // demands) never count here, so the 2-ace rules are untouched.
  const aceAnswerIdx = new Set<number>();
  if (config.aceAnswersQuestion !== false && !answersPenalty) {
    let openQ = false;
    cards.forEach((card, i) => {
      if (rankNeedsAnswer(card.rank, state)) openQ = true;
      else if (card.rank === 'A') {
        if (openQ) {
          aceAnswerIdx.add(i);
          openQ = false;
        }
      } else if (isWinningRank(card.rank, config)) {
        if (openQ) openQ = false;
      }
    });
  }

  // Resolve effects in play order.
  for (const [ci, c] of cards.entries()) {
    if (dodgesPenalty) {
      if (isJumpRank(c.rank, config)) {
        effect = `Dodged! Pick ${state.pendingPenalty} passes on`;
      } else if (isKickbackRank(c.rank, config)) {
        state.direction = (state.direction * -1) as 1 | -1;
        effect = `Dodged! Pick ${state.pendingPenalty} passes on`;
      }
      continue;
    }
    if (isPenaltyRank(c.rank, config) && !(state.pendingPenalty > 0 && c.rank === 'A')) {
      const picks = config.penaltyPicks[c.rank as '2' | '3' | 'JOKER'] ?? 0;
      // No accumulation: the latest penalty replaces the debt (top takes over).
      state.pendingPenalty = config.penaltyAccumulates && state.pendingPenalty > 0
        ? state.pendingPenalty + picks
        : picks;
      state.pendingPenaltyRank = c.rank;
      effect = `Pick ${state.pendingPenalty}`;
    } else if (c.rank === 'A') {
      // Live demand (null once satisfied or cleared earlier in this combo).
      const liveDemand = state.activeCardRequest;
      if (answersPenalty) {
        // Pure block: neutralise the penalty and call nothing, no suit,
        // no exact-card demand, even from a super ace. Preserve the suit in
        // force so the Ace's own suit does NOT take over (estate rule): keep
        // a prior request, else the penalty suit, else the last suited
        // discard (Joker penalties carry no suit).
        let preserved: Suit | null = state.activeSuit ?? suitOrNull(prevTop.suit);
        if (!preserved) {
          preserved =
            state.lastSuitBeforeRequest ??
            (() => {
              for (let i = state.discardPile.length - cards.length - 1; i >= 0; i--) {
                const s = suitOrNull(state.discardPile[i].suit);
                if (s) return s;
              }
              return null;
            })();
        }
        state.pendingPenalty = 0;
        state.pendingPenaltyRank = null;
        state.pendingPenaltySuit = null;
        state.activeCardRequest = null;
        state.activeSuit = preserved;
        effect = 'Blocked!';
      } else if (isSuper && requested) {
        // Super ace: exact-card request replaces any suit/request state.
        state.lastSuitBeforeRequest = state.activeSuit ?? suitOrNull(prevTop.suit);
        state.activeSuit = null;
        state.activeCardRequest = { ...requested };
        effect = `Bring ${requested.rank}${suitGlyph(requested.suit)}!`;
      } else if (liveDemand) {
        // Lift: a lone Ace answers a super demand by dropping the rank only.
        // The demanded suit persists, the responder calls nothing.
        state.activeCardRequest = null;
        state.activeSuit = liveDemand.suit;
        state.lastSuitBeforeRequest = null;
        effect = `Rank lifted, follow ${liveDemand.suit} ${suitGlyph(liveDemand.suit)}`;
      } else {
        // Normal ace on free play or against a suit request: declares —
        // unless it answers a question, in which case it never declares:
        // the suit auto-follows the Ace's own suit (e.g. A♠ → spades).
        // (Exact demands are lifted above; last-declares-wins holds here.)
        state.activeCardRequest = null;
        const autoFollow = aceAnswerIdx.has(ci);
        if (config.aceCallsSuit && declaredSuit && !autoFollow) {
          state.lastSuitBeforeRequest = state.activeSuit ?? suitOrNull(prevTop.suit);
          state.activeSuit = declaredSuit;
          effect = `Request ${declaredSuit}`;
        } else if (config.aceCallsSuit && (!declaredSuit || autoFollow)) {
          state.lastSuitBeforeRequest = state.activeSuit ?? suitOrNull(prevTop.suit);
          state.activeSuit = (c.suit === 'none' ? null : (c.suit as Suit));
          effect = autoFollow && state.activeSuit
            ? `Answer, follow ${state.activeSuit}`
            : state.activeSuit ? `Request ${state.activeSuit}` : null;
        }
        // Silent variant (aceCallsSuit=false): Ace only blocks, suit follows top.
      }
    } else if (isJumpRank(c.rank, config) && !jumpActsAsQuestion(state)) {
      // Counted in bulk below (response model needs the full combo shape).
    } else if (isKickbackRank(c.rank, config) && !kickbackActsAsQuestion(state)) {
      // Counted in bulk below (response model needs the full combo shape).
    }
    // Non-Ace normal play clears a declared suit.
    if (c.rank !== 'A' && state.activeSuit && state.pendingPenalty === 0) {
      // keep activeSuit only if it was just set by an Ace in THIS combo
      const aceInCombo = cards.some((k) => k.rank === 'A');
      if (!aceInCombo) state.activeSuit = null;
    }
  }

  // Jump/kickback response model. A pure single-family combo defers to the
  // victim (refuse-with-one keeps the turn; stacks must be accepted).
  // A penalty dodge skips this entirely: the debt passes on unchanged and
  // the 'Dodged!' effect from the loop above stands.
  const skipBefore = state.pendingSkip;
  const revBefore = state.pendingReverse ?? 0;
  const jumps = dodgesPenalty
    ? []
    : cards.filter((c) => isJumpRank(c.rank, config) && !jumpActsAsQuestion(state));
  const kicks = dodgesPenalty
    ? []
    : cards.filter((c) => isKickbackRank(c.rank, config) && !kickbackActsAsQuestion(state));
  // Refusal (validator guarantees exactly one card): clear the live debt and
  // keep the turn, the victim plays on.
  let keptTurn = false;
  if (skipBefore > 0 && jumps.length === 1 && kicks.length === 0) {
    state.pendingSkip = 0;
    effect = 'Jump refused! Play on';
    keptTurn = true;
  } else if (revBefore > 0 && kicks.length === 1 && jumps.length === 0) {
    state.pendingReverse = 0;
    effect = 'Reversal refused! Play on';
    keptTurn = true;
  } else {
    if (jumps.length > 0) {
      state.pendingSkip += jumps.length;
      effect = jumps.length > 1 ? `Jump ×${jumps.length}! Unrefusable` : 'Jump! Skipped';
    }
    if (kicks.length > 0 && kicks.length % 2 === 0) {
      // Even counts cancelling out: flip per card now.
      for (let i = 0; i < kicks.length; i++) {
        state.direction = (state.direction * -1) as 1 | -1;
      }
      effect = state.direction === 1 ? 'Reversed ↻' : 'Reversed ↺';
    } else if (kicks.length > 0) {
      // Odd reversals defer to the victim (stacks unrefusable).
      state.pendingReverse = revBefore + kicks.length;
      effect = kicks.length > 1 ? `Reverse ×${kicks.length}! Unrefusable` : 'Kickback! Answer or sit out';
    }
  }

  state.lastEffect = effect;

  // A fresh J/K debt defers to the victim (advance one step, debt stays live)
  // on every exit, even when the hand empties below. Refusal already kept
  // the turn above, so no advance at all in that case.
  const freshDebt =
    state.pendingSkip > skipBefore || (state.pendingReverse ?? 0) > revBefore;

  // Asked without an answer: the obligation is to draw, never a blocked move.
  // Drawn before the win check so an emptied hand refills and play continues.
  // Dodge is never a question (it takes precedence even in 2P question mode).
  if (!dodgesPenalty && comboLeavesQuestionOpen(cards, state)) {
    const owed = config.unansweredQuestionPickCount;
    if (owed > 0) {
      const drawn = drawCards(state, playerIndex, owed);
      state.lastEffect = (state.lastEffect ? state.lastEffect + ' • ' : '') + `No answer +${drawn.length}`;
    }
  }

  // Win check: hand empty AND final combo is winning-only AND Kadi was called
  // (a same-turn call counts: the press must come before the dump) AND no
  // cardless blocker.
  if (hand.length === 0) {
    const kadiOk = hasValidKadiCall(state, playerIndex);
    const winningCombo = comboIsWinningOnly(cards, state);
    const blocked = winsBlockedByCardless(state, playerIndex);
    if (kadiOk && winningCombo && !blocked) {
      state.gameOver = true;
      state.winnerIndex = playerIndex;
      return { ok: true, won: true };
    }
    // Clean dump without a valid prior call: win denied, fined instead of
    // wandering cardless. (Rule off entirely → kadiOk above, unaffected.)
    if (kadiRequired(config) && winningCombo && !blocked && !kadiOk) {
      const owed = config.lateCallPickCount;
      if (owed > 0) {
        const drawn = drawCards(state, playerIndex, owed);
        state.lastEffect = (state.lastEffect ? state.lastEffect + ' • ' : '') + `No call, fined +${drawn.length}`;
        if (freshDebt) advanceTurn(state, { steps: 1, keepSkip: true });
        else advanceTurn(state);
        return { ok: true, fined: drawn.length };
      }
      // owed 0 → legacy cardless path below.
    }
    // Emptied hand with a non-finisher (or no Kadi call): cardless, game continues.
    state.lastEffect = (state.lastEffect ? state.lastEffect + ' • ' : '') + 'Cardless, keep playing';
    if (freshDebt) advanceTurn(state, { steps: 1, keepSkip: true });
    else advanceTurn(state);
    return { ok: true, becameCardless: true };
  }

  if (!keptTurn) {
    if (freshDebt) advanceTurn(state, { steps: 1, keepSkip: true });
    else advanceTurn(state);
  }
  return { ok: true, keptTurn };
}

/** Current player cannot/does not play: draw 1 (or eat pending penalty). */
export function passOrPick(state: GameState, playerIndex: number): { picked: number; skipped: boolean } {
  if (playerIndex !== state.currentPlayer || state.gameOver) return { picked: 0, skipped: false };
  // Accept a skip: sit out, consuming the whole stack at once.
  if (state.pendingSkip > 0) {
    const n = state.pendingSkip;
    state.pendingSkip = 0;
    advanceTurn(state, { steps: n });
    state.lastEffect = 'Skipped';
    return { picked: 0, skipped: true };
  }
  // Accept a reversal: sit out with the flip applied (odd counts flip).
  if ((state.pendingReverse ?? 0) > 0) {
    const r = state.pendingReverse ?? 0;
    state.pendingReverse = 0;
    if (r % 2 === 1) state.direction = (state.direction * -1) as 1 | -1;
    advanceTurn(state);
    state.lastEffect = 'Reversal accepted, turn passes';
    return { picked: 0, skipped: true };
  }
  // Eat penalty
  if (state.pendingPenalty > 0) {
    const n = state.pendingPenalty;
    const wasJokerTop = topCard(state).rank === 'JOKER';
    const remembered = state.pendingPenaltySuit;
    state.pendingPenalty = 0;
    state.pendingPenaltyRank = null;
    state.pendingPenaltySuit = null;
    const drawn = drawCards(state, playerIndex, n);
    // Eating a Joker continues with the suit before it, the next player
    // must follow it. Legacy saves with no memory stay free-play.
    if (wasJokerTop && remembered) {
      state.activeSuit = remembered;
      state.lastEffect = `Picked ${drawn.length}, follow ${remembered}`;
    } else {
      state.lastEffect = `Picked ${drawn.length}`;
    }
    advanceTurn(state);
    return { picked: drawn.length, skipped: false };
  }
  // Cannot meet an exact-card request: draw the configured count, demand spent.
  if (state.activeCardRequest) {
    const req = state.activeCardRequest;
    state.activeCardRequest = null;
    const drawn = drawCards(state, playerIndex, state.config.unmetRequestPickCount);
    state.lastEffect = `No ${req.rank}${suitGlyph(req.suit)}, picked ${drawn.length}`;
    advanceTurn(state);
    return { picked: drawn.length, skipped: false };
  }
  // Normal pick 1
  const drawn = drawCards(state, playerIndex, 1);
  advanceTurn(state);
  return { picked: drawn.length, skipped: false };
}

/** Penalty for an illegal tap: take card back + pick N, turn passes. */
export function penaliseIllegalPlay(state: GameState, playerIndex: number): number {
  const n = state.config.invalidPlayPickCount;
  drawCards(state, playerIndex, n);
  // NOTE: caller keeps turn order, we advance to match table rules.
  if (playerIndex === state.currentPlayer) advanceTurn(state);
  return n;
}

/**
 * Strict-table wrong-play resolution. Casual tables reject with no cost (0);
 * strict tables draw the fine and lose the turn.
 */
export function resolveWrongPlay(state: GameState, playerIndex: number): number {
  if (!state.config.strictWrongPlay) return 0;
  return penaliseIllegalPlay(state, playerIndex);
}
