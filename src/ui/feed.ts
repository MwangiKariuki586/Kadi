import { cardLabel, type Card, type Suit } from '../engine/cards';
import { isJumpRank, isKickbackRank, isPenaltyRank } from '../engine/rules';
import { isSuperAceCombo } from '../engine/validator';
import type { GameState } from '../engine/state';

export type FeedTone =
  | 'play' | 'penalty' | 'block' | 'suit' | 'demand'
  | 'skip' | 'reverse' | 'draw' | 'kadi' | 'win' | 'info';

export interface FeedEvent {
  icon: string;
  text: string;
  tone: FeedTone;
}

export interface TurnSnapshot {
  pendingPenalty: number;
  pendingSkip: number;
  pendingReverse: number;
  activeSuit: Suit | null;
  activeCardRequest: { rank: Card['rank']; suit: Suit } | null;
  direction: 1 | -1;
  topSuit: Suit | 'none';
  kadi: boolean[];
  handSize: number;
}

export function snapshotState(s: GameState, me: number): TurnSnapshot {
  const top = s.discardPile[s.discardPile.length - 1];
  return {
    pendingPenalty: s.pendingPenalty,
    pendingSkip: s.pendingSkip,
    pendingReverse: s.pendingReverse ?? 0,
    activeSuit: s.activeSuit,
    activeCardRequest: s.activeCardRequest ? { ...s.activeCardRequest } : null,
    direction: s.direction,
    topSuit: top.suit,
    kadi: [...s.kadiCalls],
    handSize: s.hands[me].length,
  };
}

function suitName(suit: Suit | 'none'): string {
  switch (suit) {
    case 'hearts': return 'Hearts ♥';
    case 'diamonds': return 'Diamonds ♦';
    case 'spades': return 'Spades ♠';
    case 'clubs': return 'Clubs ♣';
    default: return 'no suit';
  }
}

function dirName(dir: 1 | -1): string {
  return dir === 1 ? 'clockwise ↻' : 'anti-clockwise ↺';
}

/** J/K only count as jump/kickback outside 2-player question mode. */
function countsAsJump(c: Card, s: GameState): boolean {
  if (s.hands.length === 2 && s.config.twoPlayerJumpAsQuestion) return false;
  return isJumpRank(c.rank, s.config);
}

function countsAsReverse(c: Card, s: GameState): boolean {
  if (s.hands.length === 2 && s.config.twoPlayerKickbackAsQuestion) return false;
  return isKickbackRank(c.rank, s.config);
}

export interface PlayOutcome {
  won?: boolean;
  cardless?: boolean;
  fined?: number;
}

/** Narrate a played combo by diffing the table before/after. */
export function describePlay(
  before: TurnSnapshot,
  after: GameState,
  me: number,
  names: string[],
  played: Card[],
  outcome: PlayOutcome = {},
): FeedEvent[] {
  const evts: FeedEvent[] = [];
  const actor = names[me] ?? `Player ${me + 1}`;
  const next = names[after.currentPlayer] ?? `Player ${after.currentPlayer + 1}`;
  const labels = played.map(cardLabel).join(' + ');

  evts.push({ icon: '▶', text: `${actor} plays ${labels}`, tone: 'play' });

  // Kadi declaration landed with this turn (bots declare inside their move).
  if (after.kadiCalls[me] && !before.kadi[me]) {
    evts.push({ icon: '📢', text: `${actor} is KADI! One clean move to win`, tone: 'kadi' });
  }

  // Penalty consequence: fresh, stacked, or neutralised. The debt always
  // follows the penalty cards played — never the top card's face value.
  if (before.pendingPenalty === 0 && after.pendingPenalty > 0) {
    const sources = played
      .filter((c) => isPenaltyRank(c.rank, after.config))
      .map(cardLabel)
      .join(', ');
    const from = sources ? ` (from ${sources})` : '';
    evts.push({ icon: '🔥', text: `Pick ${after.pendingPenalty} hangs over ${next}${from}`, tone: 'penalty' });
  } else if (before.pendingPenalty > 0 && after.pendingPenalty > 0) {
    // Answered (replaced or accumulated) — totals may be identical, so key off the answer itself.
    const sources = played
      .filter((c) => isPenaltyRank(c.rank, after.config))
      .map(cardLabel)
      .join(', ') || 'a penalty';
    evts.push({ icon: '🔥', text: `${actor} answers with ${sources} — Pick ${after.pendingPenalty} hangs over ${next}`, tone: 'penalty' });
  } else if (before.pendingPenalty > 0 && after.pendingPenalty === 0) {
    const ace = played.find((c) => c.rank === 'A');
    evts.push({
      icon: '🛡',
      text: `${actor} neutralizes the +${before.pendingPenalty} with ${ace ? cardLabel(ace) : 'an Ace'} — no one picks`,
      tone: 'block',
    });
  }

  // Exact-card demand state before/after (drives suit, demand and lift narration).
  const reqBefore = before.activeCardRequest;
  const reqAfter = after.activeCardRequest;
  const reqChanged =
    (reqBefore?.rank !== reqAfter?.rank || reqBefore?.suit !== reqAfter?.suit);

  // Suit request (new or changed) on free play. Demand resolutions (lift /
  // counter) narrate themselves below — the responder never calls a fresh suit.
  // A penalty block preserves the suit in force — never narrate it as a call.
  if (!reqBefore && after.activeSuit && after.activeSuit !== before.activeSuit && before.pendingPenalty === 0) {
    const prev = before.activeSuit ?? before.topSuit;
    evts.push({
      icon: '🎯',
      text: `${actor} calls ${suitName(after.activeSuit)} (was ${suitName(prev)})`,
      tone: 'suit',
    });
  }

  // Exact-card demand (new, raised, answered, or lifted).
  if (reqAfter && reqChanged) {
    const raised = reqBefore ? 'raises the demand to' : 'demands';
    evts.push({
      icon: '⚡',
      text: `${actor} ${raised} ${reqAfter.rank}${reqAfter.suit === 'hearts' ? '♥' : reqAfter.suit === 'diamonds' ? '♦' : reqAfter.suit === 'spades' ? '♠' : '♣'} — exact card or an Ace`,
      tone: 'demand',
    });
  } else if (reqBefore && !reqAfter) {
    const ace = played.find((c) => c.rank === 'A');
    if (ace && !isSuperAceCombo(played, after)) {
      // Lone Ace lifts the rank; the demanded suit persists — never a fresh call.
      if (after.activeSuit) {
        evts.push({
          icon: '🛡',
          text: `${actor} lifts the rank with ${cardLabel(ace)} — follow ${suitName(after.activeSuit)}`,
          tone: 'block',
        });
      } else {
        evts.push({
          icon: '🛡',
          text: `${actor} lifts the demand with ${cardLabel(ace)} — open play`,
          tone: 'block',
        });
      }
    } else if (!ace) {
      evts.push({ icon: '✅', text: `${actor} answers the demand with ${cardLabel(played[0])}`, tone: 'demand' });
    }
  }

  // Jump: refusal keeps the turn; a fresh single-family debt hangs over the
  // next player (stacks must be sat out); mixed K+J still resolves instantly.
  const jumps = played.filter((c) => countsAsJump(c, after)).length;
  if (before.pendingSkip > 0 && jumps > 0) {
    evts.push({ icon: '⏭', text: `${actor} refuses the jump — plays on`, tone: 'skip' });
  } else if (jumps > 0 && after.pendingSkip > 0) {
    const big = after.pendingSkip > 1 ? ` ×${after.pendingSkip} (too big to refuse — must sit out)` : '';
    evts.push({ icon: '⏭', text: `Jump${big} hangs over ${next} — refuse with a J or sit out`, tone: 'skip' });
  } else if (jumps > 0) {
    evts.push({ icon: '⏭', text: `Jump ×${jumps} — ${next} is up`, tone: 'skip' });
  }

  // Reversal: refusal keeps the turn; a fresh odd debt hangs over the next
  // player; even counts (or mixed K+J) resolve immediately as before.
  const flips = played.filter((c) => countsAsReverse(c, after)).length;
  if (before.pendingReverse > 0 && flips > 0) {
    evts.push({ icon: '↺', text: `${actor} refuses the reversal — plays on`, tone: 'reverse' });
  } else if (flips > 0 && (after.pendingReverse ?? 0) > 0) {
    evts.push({ icon: '↺', text: `Kickback hangs over ${next} — refuse with a K or sit out`, tone: 'reverse' });
  } else if (flips > 0) {
    evts.push({
      icon: '↺',
      text: flips % 2 === 0
        ? `Double kickback — direction unchanged (${dirName(after.direction)})`
        : `${actor} reverses — now ${dirName(after.direction)}`,
      tone: 'reverse',
    });
  }

  // Bare question: the only draw source inside a play is the no-answer obligation.
  const drawn = after.hands[me].length - (before.handSize - played.length);
  if (drawn > 0) {
    evts.push({ icon: '❓', text: `${actor} asks without an answer — picks ${drawn}`, tone: 'draw' });
  }

  if (outcome.won) {
    evts.push({ icon: '🏆', text: `${actor} finishes clean — Niko Kadi, wins the round!`, tone: 'win' });
  } else if (outcome.fined) {
    evts.push({ icon: '📢', text: `${actor} goes out without the call — fined +${outcome.fined}`, tone: 'penalty' });
  } else if (outcome.cardless) {
    evts.push({ icon: '🃏', text: `${actor} empties on a non-finisher — cardless, play continues`, tone: 'draw' });
  }

  return evts;
}

/** Narrate a pick / skip-accept: eat the count, sit out, unmet demand, or plain draw. */
export function describePick(
  before: TurnSnapshot,
  me: number,
  names: string[],
  picked: number,
  skipped: boolean,
): FeedEvent[] {
  const actor = names[me] ?? `Player ${me + 1}`;
  if (skipped) {
    if (before.pendingReverse > 0) {
      return [{ icon: '↺', text: `${actor} sits out the reversal`, tone: 'reverse' }];
    }
    return [{ icon: '⏭', text: `${actor} sits out the jump`, tone: 'skip' }];
  }
  if (before.pendingPenalty > 0) {
    return [{ icon: '🔥', text: `${actor} eats +${picked}`, tone: 'penalty' }];
  }
  if (before.activeCardRequest) {
    const req = before.activeCardRequest;
    return [{ icon: '⚡', text: `No ${req.rank} — ${actor} picks ${picked}`, tone: 'demand' }];
  }
  return [{ icon: '🃏', text: `${actor} picks a card`, tone: 'draw' }];
}

export function describeWrongPlay(actor: string, played: Card[], fined: number): FeedEvent {
  return {
    icon: '⛔',
    text: `${actor} plays wrong (${played.map(cardLabel).join(' + ')}) — fined +${fined}`,
    tone: 'penalty',
  };
}

export function describeKadi(name: string): FeedEvent {
  return { icon: '📢', text: `${name} is KADI! One clean move to win`, tone: 'kadi' };
}

export function describeDeal(top: Card): FeedEvent {
  return { icon: '🂡', text: `New match — ${cardLabel(top)} opens the pile`, tone: 'info' };
}

export function describeResume(currentPlayer: number, names: string[]): FeedEvent {
  const whose = currentPlayer === 0 ? 'your move' : `${names[currentPlayer] ?? 'bot'} to play`;
  return { icon: '↩️', text: `Back to the table — ${whose}`, tone: 'info' };
}

export type CoachTone = 'action' | 'ok' | 'bad' | 'wait' | 'win';

export interface CoachMsg {
  icon: string;
  text: string;
  tone: CoachTone;
}

export interface CoachInput {
  gameOver: boolean;
  winner: string | null;
  myTurn: boolean;
  waitingOn: string;
  busyThinking: boolean;
  pendingPenalty: number;
  pendingSkip: number;
  pendingReverse: number;
  activeSuit: Suit | null;
  prevSuit: Suit | null;
  request: { rank: Card['rank']; suit: Suit } | null;
  topLabel: string;
  selectedCount: number;
  comboValid: boolean | null;
  invalidReason: string | null;
  legalCount: number;
  kadiReady: boolean;
}

function suitGlyphLocal(suit: Suit): string {
  return suit === 'hearts' ? '♥' : suit === 'diamonds' ? '♦' : suit === 'spades' ? '♠' : '♣';
}

/**
 * One always-actionable line answering "what do I do now?".
 * Priority: confirmed legal picks first, then debts (penalty/skip/demand),
 * then corrections, then opportunities, then the default match hint.
 */
export function turnCoach(i: CoachInput): CoachMsg {
  if (i.gameOver) {
    return i.winner
      ? { icon: '🏆', text: `${i.winner} takes the round!`, tone: 'win' }
      : { icon: '🏁', text: 'Game over', tone: 'wait' };
  }
  if (i.myTurn && i.selectedCount > 0 && i.comboValid) {
    return {
      icon: '✅',
      text: i.selectedCount > 1 ? `Legal stack — hit Play (${i.selectedCount})` : 'Legal — hit Play',
      tone: 'ok',
    };
  }
  if (!i.myTurn) {
    let extra = '';
    if (i.pendingPenalty > 0) extra = ` — owes +${i.pendingPenalty}`;
    else if (i.pendingSkip > 0) extra = ' — was jumped';
    else if (i.pendingReverse > 0) extra = ' — was reversed';
    else if (i.request) extra = ` — must bring ${i.request.rank}${suitGlyphLocal(i.request.suit)}`;
    else if (i.activeSuit) extra = ` — must follow ${suitName(i.activeSuit)}`;
    return { icon: '⏳', text: `Waiting on ${i.waitingOn}${i.busyThinking ? '…' : ''}${extra}`, tone: 'wait' };
  }
  if (i.pendingPenalty > 0) {
    return { icon: '🔥', text: `You owe +${i.pendingPenalty} — stack, block with Ace, or Eat`, tone: 'action' };
  }
  if (i.pendingSkip > 0) {
    return { icon: '⏭', text: 'You were jumped — refuse with a J (keep your turn) or Accept', tone: 'action' };
  }
  if (i.pendingReverse > 0) {
    return { icon: '↺', text: 'You were reversed — refuse with a K (keep your turn) or Accept', tone: 'action' };
  }
  if (i.request) {
    return {
      icon: '⚡',
      text: `Bring ${i.request.rank}${suitGlyphLocal(i.request.suit)}, play an Ace, or Pick`,
      tone: 'action',
    };
  }
  if (i.selectedCount > 0 && !i.comboValid) {
    return { icon: '⛔', text: i.invalidReason ?? 'That combo is not legal', tone: 'bad' };
  }
  if (i.legalCount === 0) {
    return { icon: '🃏', text: 'No playable card — Pick from the pile', tone: 'action' };
  }
  if (i.kadiReady) {
    return { icon: '📢', text: 'Say KADI — you can finish next turn!', tone: 'ok' };
  }
  if (i.activeSuit) {
    const was = i.prevSuit ? ` (was ${suitName(i.prevSuit)})` : '';
    return { icon: '🎯', text: `Follow ${suitName(i.activeSuit)}${was} — ${i.legalCount} playable`, tone: 'wait' };
  }
  return { icon: '👉', text: `Match ${i.topLabel} — ${i.legalCount} playable`, tone: 'wait' };
}
