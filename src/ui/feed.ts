import { cardLabel, type Card, type Suit } from '../engine/cards';
import { isJumpRank, isKickbackRank, isPenaltyRank } from '../engine/rules';
import { isAceAnswerCombo, isSuperAceCombo } from '../engine/validator';
import type { GameState } from '../engine/state';

export type FeedTone =
  | 'play' | 'penalty' | 'block' | 'suit' | 'demand'
  | 'skip' | 'reverse' | 'draw' | 'kadi' | 'win' | 'info';

export interface FeedEvent {
  id: string;
  turn: number;
  actor: string;
  icon: string;
  text: string;
  tone: FeedTone;
}

export interface TurnGroup {
  turn: number;
  actor: string;
  events: FeedEvent[];
}

/** Chronological grouping: consecutive events sharing turn + actor stay together. */
export function groupFeed(events: FeedEvent[]): TurnGroup[] {
  const groups: TurnGroup[] = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last && last.turn === e.turn && last.actor === e.actor) {
      last.events.push(e);
    } else {
      groups.push({ turn: e.turn, actor: e.actor, events: [e] });
    }
  }
  return groups;
}

let feedSeq = 0;

function mk(turn: number, actor: string, icon: string, text: string, tone: FeedTone): FeedEvent {
  feedSeq += 1;
  return { id: `f${turn}-${feedSeq}`, turn, actor, icon, text, tone };
}

/** Second-person fix: "You play" vs "Jabari plays". */
function v(actor: string, third: string, you: string): string {
  return actor === 'You' ? you : third;
}

function isVerb(actor: string): string {
  return actor === 'You' ? 'are' : 'is';
}

export interface TurnSnapshot {
  turn: number;
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
    turn: s.turnNumber,
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
  const turn = before.turn;

  evts.push(mk(turn, actor, '▶', `${actor} ${v(actor, 'plays', 'play')} ${labels}`, 'play'));

  // Kadi declaration landed with this turn (bots declare inside their move).
  if (after.kadiCalls[me] && !before.kadi[me]) {
    evts.push(mk(turn, actor, '📢', `${actor} ${isVerb(actor)} KADI! One clean move to win — stop them!`, 'kadi'));
  }

  // Penalty consequence: fresh, stacked, or neutralised. The debt always
  // follows the penalty cards played — never the top card's face value.
  if (before.pendingPenalty === 0 && after.pendingPenalty > 0) {
    const sources = played
      .filter((c) => isPenaltyRank(c.rank, after.config))
      .map(cardLabel)
      .join(', ');
    const from = sources ? ` (from ${sources})` : '';
    evts.push(mk(turn, actor, '🔥', `Pick ${after.pendingPenalty} on ${next}${from}`, 'penalty'));
  } else if (before.pendingPenalty > 0 && after.pendingPenalty > 0) {
    // Answered (replaced or accumulated) — totals may be identical, so key off the answer itself.
    const sources = played
      .filter((c) => isPenaltyRank(c.rank, after.config))
      .map(cardLabel)
      .join(', ') || 'a penalty';
    evts.push(mk(turn, actor, '🔥', `${actor} ${v(actor, 'answers', 'answer')} with ${sources} — Pick ${after.pendingPenalty} on ${next}`, 'penalty'));
  } else if (before.pendingPenalty > 0 && after.pendingPenalty === 0) {
    const ace = played.find((c) => c.rank === 'A');
    evts.push(mk(
      turn,
      actor,
      '🛡',
      `${actor} ${v(actor, 'neutralizes', 'neutralize')} the +${before.pendingPenalty} with ${ace ? cardLabel(ace) : 'an Ace'} — no one picks`,
      'block',
    ));
  }

  // Exact-card demand state before/after (drives suit, demand and lift narration).
  const reqBefore = before.activeCardRequest;
  const reqAfter = after.activeCardRequest;
  const reqChanged =
    (reqBefore?.rank !== reqAfter?.rank || reqBefore?.suit !== reqAfter?.suit);

  // Suit request (new or changed) on free play. Demand resolutions (lift /
  // counter) narrate themselves below — the responder never calls a fresh suit.
  // A penalty block preserves the suit in force — never narrate it as a call.
  // An Ace answering a question never declares either: the suit auto-follows
  // the Ace, narrated as an answer instead of a call.
  const aceAnswerFollow =
    !reqBefore &&
    after.activeSuit &&
    before.pendingPenalty === 0 &&
    isAceAnswerCombo(played, after) &&
    !isSuperAceCombo(played, after) &&
    played.some((c) => c.rank === 'A' && c.suit === after.activeSuit);
  if (aceAnswerFollow && after.activeSuit) {
    const ace = [...played].reverse().find((c) => c.rank === 'A');
    evts.push(mk(
      turn,
      actor,
      '🎯',
      `${actor} ${v(actor, 'answers', 'answer')} with ${ace ? cardLabel(ace) : 'an Ace'} — follow ${suitName(after.activeSuit)}`,
      'suit',
    ));
  } else if (!reqBefore && after.activeSuit && after.activeSuit !== before.activeSuit && before.pendingPenalty === 0) {
    const prev = before.activeSuit ?? before.topSuit;
    evts.push(mk(
      turn,
      actor,
      '🎯',
      `${actor} ${v(actor, 'calls', 'call')} ${suitName(after.activeSuit)} (was ${suitName(prev)})`,
      'suit',
    ));
  }

  // Exact-card demand (new, raised, answered, or lifted).
  if (reqAfter && reqChanged) {
    const raised = reqBefore ? v(actor, 'raises the demand to', 'raise the demand to') : v(actor, 'demands', 'demand');
    evts.push(mk(
      turn,
      actor,
      '⚡',
      `${actor} ${raised} ${reqAfter.rank}${reqAfter.suit === 'hearts' ? '♥' : reqAfter.suit === 'diamonds' ? '♦' : reqAfter.suit === 'spades' ? '♠' : '♣'} — exact card or an Ace`,
      'demand',
    ));
  } else if (reqBefore && !reqAfter) {
    const ace = played.find((c) => c.rank === 'A');
    if (ace && !isSuperAceCombo(played, after)) {
      // Lone Ace lifts the rank; the demanded suit persists — never a fresh call.
      if (after.activeSuit) {
        evts.push(mk(
          turn,
          actor,
          '🛡',
          `${actor} ${v(actor, 'lifts', 'lift')} the rank with ${cardLabel(ace)} — follow ${suitName(after.activeSuit)}`,
          'block',
        ));
      } else {
        evts.push(mk(
          turn,
          actor,
          '🛡',
          `${actor} ${v(actor, 'lifts', 'lift')} the demand with ${cardLabel(ace)} — open play`,
          'block',
        ));
      }
    } else if (!ace) {
      evts.push(mk(turn, actor, '✅', `${actor} ${v(actor, 'answers', 'answer')} the demand with ${cardLabel(played[0])}`, 'demand'));
    }
  }

  // Jump: refusal keeps the turn; a fresh single-family debt lands on the
  // next player (stacks must be sat out).
  const jumps = played.filter((c) => countsAsJump(c, after)).length;
  if (before.pendingSkip > 0 && jumps > 0) {
    evts.push(mk(turn, actor, '⏭', `${actor} ${v(actor, 'refuses', 'refuse')} the jump — ${v(actor, 'plays', 'play')} on`, 'skip'));
  } else if (jumps > 0 && after.pendingSkip > 0) {
    const big = after.pendingSkip > 1 ? ` ×${after.pendingSkip} (must sit out)` : '';
    evts.push(mk(turn, actor, '⏭', `Jump${big} on ${next} — J to refuse or sit out`, 'skip'));
  } else if (jumps > 0) {
    evts.push(mk(turn, actor, '⏭', `Jump ×${jumps} — ${next} ${next === 'You' ? 'are' : 'is'} up`, 'skip'));
  }

  // Reversal: refusal keeps the turn; a fresh odd debt lands on the next
  // player; even counts resolve immediately.
  const flips = played.filter((c) => countsAsReverse(c, after)).length;
  if (before.pendingReverse > 0 && flips > 0) {
    evts.push(mk(turn, actor, '↺', `${actor} ${v(actor, 'refuses', 'refuse')} the reversal — ${v(actor, 'plays', 'play')} on`, 'reverse'));
  } else if (flips > 0 && (after.pendingReverse ?? 0) > 0) {
    evts.push(mk(turn, actor, '↺', `Kickback on ${next} — K to refuse or sit out`, 'reverse'));
  } else if (flips > 0) {
    evts.push(mk(
      turn,
      actor,
      '↺',
      flips % 2 === 0
        ? `Double kickback — direction unchanged (${dirName(after.direction)})`
        : `${actor} ${v(actor, 'reverses', 'reverse')} — now ${dirName(after.direction)}`,
      'reverse',
    ));
  }

  // Bare question: the only draw source inside a play is the no-answer obligation.
  const drawn = after.hands[me].length - (before.handSize - played.length);
  if (drawn > 0) {
    evts.push(mk(turn, actor, '❓', `${actor} ${v(actor, 'asks', 'ask')} without an answer — ${v(actor, 'picks', 'pick')} ${drawn}`, 'draw'));
  }

  if (outcome.won) {
    evts.push(mk(turn, actor, '🏆', `${actor} ${v(actor, 'finishes', 'finish')} clean — Niko Kadi, wins the round!`, 'win'));
  } else if (outcome.fined) {
    evts.push(mk(turn, actor, '📢', `${actor} ${v(actor, 'goes', 'go')} out without the call — fined +${outcome.fined}`, 'penalty'));
  } else if (outcome.cardless) {
    evts.push(mk(turn, actor, '🃏', `${actor} ${v(actor, 'empties', 'empty')} on a non-finisher — cardless, play continues`, 'draw'));
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
  const turn = before.turn;
  if (skipped) {
    if (before.pendingReverse > 0) {
      return [mk(turn, actor, '↺', `${actor} ${v(actor, 'sits', 'sit')} out the reversal`, 'reverse')];
    }
    return [mk(turn, actor, '⏭', `${actor} ${v(actor, 'sits', 'sit')} out the jump`, 'skip')];
  }
  if (before.pendingPenalty > 0) {
    return [mk(turn, actor, '🔥', `${actor} ${v(actor, 'eats', 'eat')} +${picked}`, 'penalty')];
  }
  if (before.activeCardRequest) {
    const req = before.activeCardRequest;
    return [mk(turn, actor, '⚡', `No ${req.rank} — ${actor} ${v(actor, 'picks', 'pick')} ${picked}`, 'demand')];
  }
  return [mk(turn, actor, '🃏', `${actor} ${v(actor, 'picks', 'pick')} a card`, 'draw')];
}

export function describeWrongPlay(actor: string, played: Card[], fined: number, turn = 0): FeedEvent {
  return mk(
    turn,
    actor,
    '⛔',
    `${actor} ${v(actor, 'plays', 'play')} wrong (${played.map(cardLabel).join(' + ')}) — fined +${fined}`,
    'penalty',
  );
}

export function describeKadi(name: string, turn = 0): FeedEvent {
  return mk(turn, name, '📢', `${name} ${name === 'You' ? 'are' : 'is'} KADI! One clean move to win — stop them!`, 'kadi');
}

export function describeFalseKadi(name: string, fined: number, turn = 0): FeedEvent {
  return mk(
    turn,
    name,
    '⛔',
    `${name} ${v(name, 'calls', 'call')} KADI too early — no winnable hand, fined +${fined}`,
    'penalty',
  );
}

export function describeDelayKadi(name: string, fined: number, turn = 0): FeedEvent {
  return mk(
    turn,
    name,
    '⏱',
    `${name} slept on KADI — shouted too late, fined +${fined}`,
    'penalty',
  );
}

export function describeDeal(top: Card, turn = 0): FeedEvent {
  return mk(turn, 'Table', '🂡', `New match — ${cardLabel(top)} opens the pile`, 'info');
}

export function describeResume(currentPlayer: number, names: string[], turn = 0): FeedEvent {
  const whose = currentPlayer === 0 ? 'you to play' : `${names[currentPlayer] ?? 'bot'} to play`;
  const actor = currentPlayer === 0 ? 'You' : (names[currentPlayer] ?? 'bot');
  return mk(turn, actor, '↩️', `Back at the table — ${whose}`, 'info');
}

export function describeStall(name: string, detail: string, turn = 0): FeedEvent {
  return mk(turn, name, '🐞', `${name} stalls — illegal move blocked (${detail})`, 'info');
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
