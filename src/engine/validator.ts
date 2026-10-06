import { colorFamilyOf, type Card, type Suit } from './cards';
import {
  isJumpRank, isKickbackRank, isPenaltyRank, isQuestionRank, isWinningRank,
  type RulesConfig,
} from './rules';
import { advanceTurn, drawCards, topCard, type GameState } from './state';

export type InvalidReason =
  | 'NOT_YOUR_TURN' | 'CARD_NOT_IN_HAND' | 'GAME_OVER'
  | 'NO_MATCH' | 'QUESTION_NEEDS_ANSWER' | 'PENALTY_MUST_STACK_OR_BLOCK'
  | 'ACE_ONLY_STACKS_WITH_ACE' | 'MUST_BE_SAME_RANK'
  | 'SKIP_MUST_COUNTER_OR_ACCEPT' | 'CANNOT_WIN_YET' | 'UNMET_REQUEST';

export interface ComboCheck {
  ok: boolean;
  reason?: InvalidReason;
}

/**
 * Single card matches top? Handles Ace-declared suit + Joker-top wildness.
 */
export function singleMatchesTop(card: Card, state: GameState): boolean {
  const top = topCard(state);
  // After a Joker, anything goes (prevents deadlock).
  if (top.rank === 'JOKER') return true;
  // Ace declared a suit: follow it (or re-Ace).
  if (state.activeSuit) {
    if (card.rank === 'A') return true;
    return card.suit === state.activeSuit;
  }
  // Joker is wild — always playable.
  if (card.rank === 'JOKER') return true;
  // Ace is wild (request) — always playable.
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
 * may answer a pending penalty:
 * - same rank, any suit (2♣ on 2♥)
 * - same suit, any penalty rank (3♥ on 2♥)
 * - Joker involved on either side: color families must match
 *   (red Joker on 2♥; 2♥/2♦/red-Joker on a red Joker)
 */
export function penaltyAnswerOk(card: Card, table: Card, config: RulesConfig): boolean {
  if (card.rank === 'A') return config.aceBlocksPenalty;
  if (!isPenaltyRank(card.rank, config)) return false;
  if (!config.allowPenaltyStacking) return false;
  if (table.rank === 'JOKER' || card.rank === 'JOKER') {
    return colorFamilyOf(card) === colorFamilyOf(table);
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

/** An Ace plays solo or stacks only with other Aces — never with normal cards. */
function mixesAceWithNonAce(cards: Card[]): boolean {
  return cards.some((c) => c.rank === 'A') && !cards.every((c) => c.rank === 'A');
}

/**
 * Free-play combo shape: every card shares one rank (first matches the top,
 * rest match rank, any suit) — except J/K family stacks together, and a
 * question leads same-suit winning answers (4 5 6 7 9 10) only. Returns a
 * rejection, or null when the shape is acceptable (suit/rank chaining and
 * question closure are validated separately by the caller).
 */
function checkComboShape(cards: Card[], state: GameState): ComboCheck | null {
  const { config } = state;
  const allSameRank = cards.every((c) => c.rank === cards[0].rank);
  const allJumpKickback = cards.every(
    (c) => isJumpRank(c.rank, config) || isKickbackRank(c.rank, config),
  );
  const questionLed = rankNeedsAnswer(cards[0].rank, state);
  if (!allSameRank && !allJumpKickback && !questionLed) {
    return { ok: false, reason: 'MUST_BE_SAME_RANK' };
  }
  if (questionLed && !allSameRank) {
    for (const c of cards.slice(1)) {
      if (!isWinningRank(c.rank, config)) return { ok: false, reason: 'MUST_BE_SAME_RANK' };
      if (config.mustAnswerSameSuit && c.suit !== cards[0].suit) {
        return { ok: false, reason: 'MUST_BE_SAME_RANK' };
      }
    }
  }
  return null;
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
      const isAnswer = isWinningRank(c.rank, config);
      if (!isAnswer) {
        // stacking another question is fine — still open
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
 * Always legal to play — the obligation is to draw, enforced in playCombo.
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

  // Pending skip: only a counter-Jump (any J) or accept-skip is legal.
  if (state.pendingSkip > 0) {
    if (!config.jumpCounterable) return { ok: false, reason: 'SKIP_MUST_COUNTER_OR_ACCEPT' };
    const allJumps = cards.every((c) => isJumpRank(c.rank, config));
    if (!allJumps) return { ok: false, reason: 'SKIP_MUST_COUNTER_OR_ACCEPT' };
    return { ok: true };
  }

  // Pending penalty: only penalty-family answers or Ace block.
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
    if (!isPenaltyRank(cards[0].rank, config) || !penaltyAnswerOk(cards[0], table, config)) {
      return { ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' };
    }
    const links = validateChainLinks(cards);
    if (!links.ok) return links;
    // Every stacked card must itself be a penalty card (no sneaking in answers).
    if (!cards.every((c) => isPenaltyRank(c.rank, config))) {
      return { ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' };
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
    if (mixesAceWithNonAce(cards)) {
      return { ok: false, reason: 'ACE_ONLY_STACKS_WITH_ACE' };
    }
    if (mixesPenaltyWithNormal(cards, config)) {
      return { ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' };
    }
    const shapeReq = checkComboShape(cards, state);
    if (shapeReq) return shapeReq;
    const links = validateChainLinks(cards);
    if (!links.ok) return links;
    // An unanswered question here is legal too — draw obligation applies.
    return { ok: true };
  }

  // Normal: first card matches top.
  if (!singleMatchesTop(cards[0], state)) return { ok: false, reason: 'NO_MATCH' };

  // An Ace plays solo or with Aces only — A + 10 is never a combo, even suited.
  if (mixesAceWithNonAce(cards)) {
    return { ok: false, reason: 'ACE_ONLY_STACKS_WITH_ACE' };
  }
  // A penalty card only stacks with other penalties — never with normal cards,
  // even when the suits connect. Eat the debt first, then resume normal play.
  if (mixesPenaltyWithNormal(cards, config)) {
    return { ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' };
  }
  // Same-rank stacks (J/K family together; questions take same-suit answers).
  const shape = checkComboShape(cards, state);
  if (shape) return shape;
  const links = validateChainLinks(cards);
  if (!links.ok) return links;
  // An unanswered question is legal — the obligation is to draw (see playCombo),
  // never a blocked move.
  return { ok: true };
}

/** All legal single-card moves for UI hints + Easy bots. */
export function legalSingles(state: GameState, playerIndex: number): Card[] {
  const hand = state.hands[playerIndex];
  return hand.filter((c) => validateCombo([c], state, playerIndex).ok);
}

function comboIsWinningOnly(cards: Card[], state: GameState): boolean {
  // Final dump must end "clean": only winning ranks, or questions closed by winning answer.
  // J/K/A/penalties can never be the closer.
  const last = cards[cards.length - 1];
  if (!isWinningRank(last.rank, state.config)) return false;
  // Reuse combo chaining rules: if it chains legally and ends on answer, it's a winning combo.
  // (Questions inside are fine as long as each was answered — validated by caller.)
  return true;
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

/** Largest hand that gets an exact finish search (7! = 5040 checks worst case). */
const FINISH_SEARCH_CAP = 7;

/**
 * Live threat check for the KADI! badge: the player declared on an earlier
 * turn AND can dump their entire hand in one legal, winning-only combo
 * against the current table. Anything else (debt to answer, undeclared,
 * cardless blocker, oversized hand) reads as not-finishable.
 */
export function canFinishNow(state: GameState, playerIndex: number): boolean {
  const { config } = state;
  if (state.gameOver) return false;
  const hand = state.hands[playerIndex];
  if (hand.length === 0 || hand.length > FINISH_SEARCH_CAP) return false;
  // Penalty/skip debts must be answered first — and their answers can never close.
  if (state.pendingPenalty > 0 || state.pendingSkip > 0) return false;
  // Must have said Kadi on a strictly earlier turn (same rule as the win itself).
  if (!state.kadiCalls[playerIndex] || !(state.kadiCallTurn[playerIndex] < state.turnNumber)) return false;
  if (config.cardlessBlocksWin && state.hands.some((h, i) => i !== playerIndex && h.length === 0)) return false;
  // The closer must be a winning rank.
  if (!hand.some((c) => isWinningRank(c.rank, config))) return false;

  let capable = false;
  eachPermutation(hand, (perm) => {
    const last = perm[perm.length - 1];
    if (!isWinningRank(last.rank, config)) return false;
    if (validateVsTable(perm, state).ok) {
      capable = true;
      return true;
    }
    return false;
  });
  return capable;
}

export function canDeclareKadi(state: GameState, playerIndex: number): boolean {
  if (state.gameOver || state.hands[playerIndex].length === 0) return false;
  return !state.kadiCalls[playerIndex];
}

export function declareKadi(state: GameState, playerIndex: number): boolean {
  if (!canDeclareKadi(state, playerIndex)) return false;
  state.kadiCalls[playerIndex] = true;
  state.kadiCallTurn[playerIndex] = state.turnNumber;
  state.lastEffect = `${playerIndex === 0 ? 'You are' : `Player ${playerIndex + 1} is`} KADI!`;
  return true;
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
  // Top card BEFORE this combo lands — remembers the suit an Ace overrides.
  const prevTop = topCard(state);

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
  // aces-only here) — a pure block that calls nothing further.
  const answersPenalty = state.pendingPenalty > 0;

  // Resolve effects in play order.
  for (const c of cards) {
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
        // Pure block: neutralise the penalty and call nothing — no suit,
        // no exact-card demand, even from a super ace.
        state.pendingPenalty = 0;
        state.pendingPenaltyRank = null;
        state.activeCardRequest = null;
        effect = 'Blocked!';
      } else if (isSuper && requested) {
        // Super ace: exact-card request replaces any suit/request state.
        state.lastSuitBeforeRequest = state.activeSuit ?? suitOrNull(prevTop.suit);
        state.activeSuit = null;
        state.activeCardRequest = { ...requested };
        effect = `Bring ${requested.rank}${suitGlyph(requested.suit)}!`;
      } else if (liveDemand) {
        // Lift: a lone Ace answers a super demand by dropping the rank only.
        // The demanded suit persists — the responder calls nothing.
        state.activeCardRequest = null;
        state.activeSuit = liveDemand.suit;
        state.lastSuitBeforeRequest = null;
        effect = `Rank lifted — follow ${liveDemand.suit} ${suitGlyph(liveDemand.suit)}`;
      } else {
        // Normal ace on free play or against a suit request: declares.
        // (Exact demands are lifted above; last-declares-wins holds here.)
        state.activeCardRequest = null;
        if (config.aceCallsSuit && declaredSuit) {
          state.lastSuitBeforeRequest = state.activeSuit ?? suitOrNull(prevTop.suit);
          state.activeSuit = declaredSuit;
          effect = `Request ${declaredSuit}`;
        } else if (config.aceCallsSuit && !declaredSuit) {
          state.lastSuitBeforeRequest = state.activeSuit ?? suitOrNull(prevTop.suit);
          state.activeSuit = (c.suit === 'none' ? null : (c.suit as Suit));
          effect = state.activeSuit ? `Request ${state.activeSuit}` : null;
        }
        // Silent variant (aceCallsSuit=false): Ace only blocks, suit follows top.
      }
    } else if (isJumpRank(c.rank, config) && !jumpActsAsQuestion(state)) {
      state.pendingSkip += 1;
      effect = 'Jump! Skipped';
    } else if (isKickbackRank(c.rank, config) && !kickbackActsAsQuestion(state)) {
      state.direction = (state.direction * -1) as 1 | -1;
      effect = state.direction === 1 ? 'Reversed ↻' : 'Reversed ↺';
    }
    // Non-Ace normal play clears a declared suit.
    if (c.rank !== 'A' && state.activeSuit && state.pendingPenalty === 0) {
      // keep activeSuit only if it was just set by an Ace in THIS combo
      const aceInCombo = cards.some((k) => k.rank === 'A');
      if (!aceInCombo) state.activeSuit = null;
    }
  }

  // Counter-Jump consumes the skip instead of adding: net effect handled above
  // (pendingSkip was >0 and we played jumps). Each counter-J offsets one skip.
  if (state.pendingSkip > 0 && cards.every((c) => isJumpRank(c.rank, config))) {
    // played N jumps while skipped: first offsets, rest add. Simplify: keep as-is
    // (skip was not yet consumed since advanceTurn consumes it).
  }

  state.lastEffect = effect;

  // Asked without an answer: the obligation is to draw — never a blocked move.
  // Drawn before the win check so an emptied hand refills and play continues.
  if (comboLeavesQuestionOpen(cards, state)) {
    const owed = config.unansweredQuestionPickCount;
    if (owed > 0) {
      const drawn = drawCards(state, playerIndex, owed);
      state.lastEffect = (state.lastEffect ? state.lastEffect + ' • ' : '') + `No answer +${drawn.length}`;
    }
  }

  // Win check: hand empty AND final combo is winning-only AND Kadi declared earlier AND no cardless blocker.
  if (hand.length === 0) {
    const kadiOk =
      !config.mustSayNikoKadi ||
      (state.kadiCalls[playerIndex] && state.kadiCallTurn[playerIndex] < state.turnNumber);
    const winningCombo = comboIsWinningOnly(cards, state);
    const blocked = winsBlockedByCardless(state, playerIndex);
    if (kadiOk && winningCombo && !blocked) {
      state.gameOver = true;
      state.winnerIndex = playerIndex;
      return { ok: true, won: true };
    }
    // Clean dump without a valid prior call: win denied, fined instead of
    // wandering cardless. (Rule off entirely → kadiOk above, unaffected.)
    if (config.mustSayNikoKadi && winningCombo && !blocked && !kadiOk) {
      const owed = config.lateCallPickCount;
      if (owed > 0) {
        const drawn = drawCards(state, playerIndex, owed);
        state.lastEffect = (state.lastEffect ? state.lastEffect + ' • ' : '') + `No call — fined +${drawn.length}`;
        advanceTurn(state);
        return { ok: true, fined: drawn.length };
      }
      // owed 0 → legacy cardless path below.
    }
    // Emptied hand with a non-finisher (or no Kadi call): cardless, game continues.
    state.lastEffect = (state.lastEffect ? state.lastEffect + ' • ' : '') + 'Cardless — keep playing';
    advanceTurn(state);
    return { ok: true, becameCardless: true };
  }

  advanceTurn(state);
  return { ok: true };
}

/** Current player cannot/does not play: draw 1 (or eat pending penalty). */
export function passOrPick(state: GameState, playerIndex: number): { picked: number; skipped: boolean } {
  if (playerIndex !== state.currentPlayer || state.gameOver) return { picked: 0, skipped: false };
  // Accept a skip
  if (state.pendingSkip > 0) {
    advanceTurn(state);
    state.lastEffect = 'Skipped';
    return { picked: 0, skipped: true };
  }
  // Eat penalty
  if (state.pendingPenalty > 0) {
    const n = state.pendingPenalty;
    state.pendingPenalty = 0;
    state.pendingPenaltyRank = null;
    const drawn = drawCards(state, playerIndex, n);
    state.lastEffect = `Picked ${drawn.length}`;
    advanceTurn(state);
    return { picked: drawn.length, skipped: false };
  }
  // Cannot meet an exact-card request: draw the configured count, demand spent.
  if (state.activeCardRequest) {
    const req = state.activeCardRequest;
    state.activeCardRequest = null;
    const drawn = drawCards(state, playerIndex, state.config.unmetRequestPickCount);
    state.lastEffect = `No ${req.rank}${suitGlyph(req.suit)} — picked ${drawn.length}`;
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
  // NOTE: caller keeps turn order — we advance to match table rules.
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
