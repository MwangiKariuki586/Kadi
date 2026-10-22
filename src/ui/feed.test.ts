import { describe, expect, it } from 'vitest';
import type { Card } from '../engine/cards';
import { STANDARD_MAUA } from '../engine/rules';
import { createGame, type GameState } from '../engine/state';
import { passOrPick, playCombo } from '../engine/validator';
import {
  describeDeal, describeDelayKadi, describeFalseKadi, describeKadi, describeNotice, describePick, describePlay, describeResume, describeWrongPlay, groupFeed, snapshotState, turnCoach,
  type CoachInput,
} from './feed';

const NAMES = ['You', 'Jabari', 'Amani'];

const C = (rank: Card['rank'], suit: Card['suit'] = 'hearts', id?: string): Card => ({
  id: id ?? `${rank}-${suit}-${Math.random().toString(36).slice(2, 7)}`,
  suit, rank,
});

function table(hand0: Card[], top: Card, rest: Card[], numPlayers = 2): GameState {
  const s = createGame({ numPlayers, config: STANDARD_MAUA, random: () => 0.999 });
  s.hands[0] = hand0;
  s.hands[1] = rest;
  s.discardPile = [top];
  s.currentPlayer = 0;
  s.pendingPenalty = 0;
  s.pendingSkip = 0;
  s.activeSuit = null;
  s.activeCardRequest = null;
  s.drawPile = Array.from({ length: 30 }, (_, i) => C('7', 'clubs', `d${i}`));
  return s;
}

describe('feed', () => {
  it('fresh penalty names the count and who owes', () => {
    const s = table([C('2', 'hearts', 't')], C('9', 'hearts'), [C('4', 'clubs')]);
    const before = snapshotState(s, 0);
    playCombo(s, 0, [s.hands[0][0]]);
    const evts = describePlay(before, s, 0, NAMES, [C('2', 'hearts', 't')]);
    const text = evts.map((e) => e.text).join(' | ');
    expect(text).toMatch(/Pick 2 on Jabari/);
    expect(text).toMatch(/\(from 2♥\)/);
  });

  it('answer narrates the replacing count and source', () => {
    const s = table([C('2', 'hearts', 't')], C('9', 'hearts'), [C('2', 'spades', 's2')]);
    playCombo(s, 0, [s.hands[0][0]]);
    const before = snapshotState(s, 1);
    playCombo(s, 1, [s.hands[1][0]]);
    const evts = describePlay(before, s, 1, NAMES, [C('2', 'spades', 's2')]);
    const text = evts.map((e) => e.text).join(' | ');
    expect(text).toMatch(/answers with 2♠\. Pick 2 on You/);
  });

  it('eating and blocking are narrated with counts', () => {
    const s = table([C('2', 'hearts', 't')], C('9', 'hearts'), [C('4', 'clubs')]);
    playCombo(s, 0, [s.hands[0][0]]);
    const before = snapshotState(s, 1);
    const r = passOrPick(s, 1);
    expect(describePick(before, 1, NAMES, r.picked, r.skipped)[0].text).toBe('Jabari eats +2');

    const s2 = table([C('2', 'hearts', 't')], C('9', 'hearts'), [C('A', 'clubs', 'a')]);
    playCombo(s2, 0, [s2.hands[0][0]]);
    const b2 = snapshotState(s2, 1);
    playCombo(s2, 1, [s2.hands[1][0]], 'clubs');
    const evts = describePlay(b2, s2, 1, NAMES, [C('A', 'clubs', 'a')]);
    expect(evts.map((e) => e.text).join(' | ')).toMatch(/neutralizes the \+2.*no one picks/);
    // Pure block preserves hearts, never narrated as a fresh suit call.
    expect(s2.activeSuit).toBe('hearts');
    expect(evts.map((e) => e.text).join(' | ')).not.toMatch(/calls/);
  });

  it('suit request always names the previous suit', () => {
    const s = table([C('A', 'clubs', 'a')], C('9', 'hearts'), [C('4', 'spades')]);
    const before = snapshotState(s, 0);
    playCombo(s, 0, [s.hands[0][0]], 'spades');
    const evts = describePlay(before, s, 0, NAMES, [C('A', 'clubs', 'a')]);
    expect(evts.map((e) => e.text).join(' | ')).toMatch(/calls? Spades.*was Hearts/);
  });

  it('bare question narrates the forced draw', () => {
    const s = table([C('Q', 'hearts', 'q'), C('4', 'clubs', 'k')], C('9', 'hearts'), [C('5', 'spades')]);
    const before = snapshotState(s, 0);
    playCombo(s, 0, [s.hands[0][0]]);
    const evts = describePlay(before, s, 0, NAMES, [C('Q', 'hearts', 'q')]);
    expect(evts.map((e) => e.text).join(' | ')).toMatch(/asks? without an answer, picks? 1/);
  });

  it('jump and reversal defer to the victim; refusal keeps the turn', () => {
    const s = table(
      [C('J', 'hearts', 'jh'), C('4', 'clubs', 'k')],
      C('10', 'hearts'),
      [C('J', 'spades', 'js'), C('5', 'diamonds', 'o')],
      3,
    );
    const before = snapshotState(s, 0);
    playCombo(s, 0, [s.hands[0][0]]);
    expect(s.pendingSkip).toBe(1);
    expect(describePlay(before, s, 0, NAMES, [C('J', 'hearts', 'jh')]).map((e) => e.text).join(' | '))
      .toMatch(/on Jabari, J to refuse or sit out/);
    const b2 = snapshotState(s, 1);
    playCombo(s, 1, [s.hands[1][0]]);
    expect(describePlay(b2, s, 1, NAMES, [C('J', 'spades', 'js')]).map((e) => e.text).join(' | '))
      .toMatch(/refuses the jump, plays on/);

    const s2 = table([C('K', 'hearts', 'kh'), C('4', 'clubs', 'k')], C('9', 'hearts'), [C('5', 'spades')], 3);
    const c2 = snapshotState(s2, 0);
    playCombo(s2, 0, [s2.hands[0][0]]);
    expect(s2.pendingReverse).toBe(1);
    expect(s2.direction).toBe(1);
    expect(describePlay(c2, s2, 0, NAMES, [C('K', 'hearts', 'kh')]).map((e) => e.text).join(' | '))
      .toMatch(/on Jabari, K to refuse or sit out/);
  });

  it('lone-ace lift keeps the demanded suit in the narration', () => {
    const s = table([C('4', 'clubs', 'k')], C('9', 'hearts'), [C('A', 'clubs', 'ac'), C('4', 'diamonds', 'o')]);
    s.activeCardRequest = { rank: '5', suit: 'hearts' };
    s.currentPlayer = 1;
    const before = snapshotState(s, 1);
    playCombo(s, 1, [s.hands[1][0]]);
    const text = describePlay(before, s, 1, NAMES, [C('A', 'clubs', 'ac')]).map((e) => e.text).join(' | ');
    expect(text).toMatch(/lifts the rank.*follow Hearts/);
    expect(text).not.toMatch(/calls/);
  });

  it('wrong-play fine names the cards and the count', () => {
    const text = describeWrongPlay('You', [C('K', 'diamonds', 'k')], 1).text;
    expect(text).toBe('You play wrong (K♦), fined +1');
  });

  it('late win attempt narrates the fine', () => {
    const fin = C('5', 'hearts', 'f');
    const s = table([fin], C('9', 'hearts'), [C('6', 'spades')]);
    const before = snapshotState(s, 0);
    const r = playCombo(s, 0, [fin]);
    expect(r.fined).toBe(1);
    const text = describePlay(before, s, 0, NAMES, [fin], { fined: r.fined }).map((e) => e.text).join(' | ');
    expect(text).toMatch(/go(es)? out without the call, fined \+1/);
  });

  it('deal event opens with the starter', () => {
    const s = createGame({ numPlayers: 2, random: () => 0.5 });
    const top = s.discardPile[0];
    expect(describeDeal(top).text).toContain('opens the pile');
  });

  it('kadi call warns the table; false call names the fine', () => {
    expect(describeKadi('You').text).toMatch(/Stop them/);
    expect(describeKadi('You').text).toMatch(/You are KADI/);
    expect(describeFalseKadi('You', 1).text).toBe('You call KADI too early, no winnable hand, fined +1');
    expect(describeFalseKadi('Jabari', 1).text).toBe('Jabari calls KADI too early, no winnable hand, fined +1');
    expect(describeDelayKadi('You', 1).text).toBe('You slept on KADI, shouted too late, fined +1');
  });

  it('ace answering a question narrates the follow, never a call', () => {
    const q = C('Q', 'spades', 'q');
    const ace = C('A', 'spades', 'a');
    const s = table([q, ace, C('4', 'clubs', 'k')], C('9', 'spades'), [C('5', 'hearts')]);
    const before = snapshotState(s, 0);
    playCombo(s, 0, [q, ace], null);
    const text = describePlay(before, s, 0, NAMES, [q, ace]).map((e) => e.text).join(' | ');
    expect(text).toMatch(/answers? with A♠, follow Spades/);
    expect(text).not.toMatch(/calls/);
  });

  it('second person uses base verb forms', () => {
    const s = table([C('7', 'hearts', 'h')], C('9', 'hearts'), [C('4', 'clubs')]);
    const before = snapshotState(s, 0);
    playCombo(s, 0, [s.hands[0][0]]);
    const text = describePlay(before, s, 0, NAMES, [C('7', 'hearts', 'h')]).map((e) => e.text).join(' | ');
    expect(text).toMatch(/You play 7♥/);
    expect(text).not.toMatch(/You plays/);
    expect(describePick(snapshotState(s, 1), 1, NAMES, 0, true)[0].text).toBe('Jabari sits out the jump');
    const sYou = table([C('4', 'clubs')], C('9', 'hearts'), [C('4', 'spades')]);
    sYou.pendingSkip = 1;
    sYou.currentPlayer = 0;
    const bYou = snapshotState(sYou, 0);
    expect(describePick(bYou, 0, NAMES, 0, true)[0].text).toBe('You sit out the jump');
  });

  it('events carry turn, actor and stable ids; groups stay chronological', () => {
    const s = table([C('2', 'hearts', 't')], C('9', 'hearts'), [C('4', 'clubs')]);
    const before = snapshotState(s, 0);
    playCombo(s, 0, [s.hands[0][0]]);
    const playEvts = describePlay(before, s, 0, NAMES, [C('2', 'hearts', 't')]);
    expect(playEvts.length).toBeGreaterThanOrEqual(2);
    expect(playEvts[0].actor).toBe('You');
    expect(playEvts[0].turn).toBe(before.turn);
    expect(new Set(playEvts.map((e) => e.id)).size).toBe(playEvts.length);
    const b2 = snapshotState(s, 1);
    const pickEvts = describePick(b2, 1, NAMES, 2, false);
    const all = [...playEvts, ...pickEvts];
    const groups = groupFeed(all);
    expect(groups[0].actor).toBe('You');
    expect(groups[groups.length - 1].actor).toBe('Jabari');
    expect(groups.flatMap((g) => g.events).map((e) => e.id)).toEqual(all.map((e) => e.id));
  });

  it('resume no longer claims your move', () => {
    expect(describeResume(0, NAMES, 3).text).toBe('Back at the table, you to play');
    expect(describeResume(1, NAMES, 3).text).toBe('Back at the table, Jabari to play');
  });

  it('dead-tap notices are info events that group with the same turn+actor', () => {
    const a = describeNotice('You', 'Wait for your turn…', 5);
    const b = describeNotice('You', 'KADI already called, go out and finish!', 5);
    expect(a.tone).toBe('info');
    expect(a.actor).toBe('You');
    expect(a.turn).toBe(5);
    expect(a.id).not.toBe(b.id);
    const groups = groupFeed([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].events.map((e) => e.text)).toEqual([
      'Wait for your turn…',
      'KADI already called, go out and finish!',
    ]);
  });
});

describe('turnCoach', () => {
  const base: CoachInput = {
    gameOver: false,
    winner: null,
    myTurn: true,
    waitingOn: 'Jabari',
    busyThinking: false,
    pendingPenalty: 0,
    pendingSkip: 0,
    pendingReverse: 0,
    activeSuit: null,
    prevSuit: null,
    request: null,
    topLabel: '10♥',
    selectedCount: 0,
    comboValid: null,
    invalidReason: null,
    legalCount: 3,
    kadiReady: false,
  };

  it('confirms a legal selection first, even with table state around', () => {
    const msg = turnCoach({ ...base, selectedCount: 2, comboValid: true });
    expect(msg.tone).toBe('ok');
    expect(msg.text).toMatch(/Legal stack/);
  });

  it('debts beat idle hints: penalty, skip, reversal, demand', () => {
    expect(turnCoach({ ...base, pendingPenalty: 3 }).tone).toBe('action');
    expect(turnCoach({ ...base, pendingPenalty: 3 }).text).toMatch(/owe \+3/);
    expect(turnCoach({ ...base, pendingSkip: 1 }).text).toMatch(/jumped/);
    expect(turnCoach({ ...base, pendingReverse: 1 }).text).toMatch(/reversed/);
    expect(turnCoach({ ...base, request: { rank: '5', suit: 'hearts' } }).text).toMatch(/Bring 5♥/);
  });

  it('invalid selection explains itself', () => {
    const msg = turnCoach({ ...base, selectedCount: 1, comboValid: false, invalidReason: 'Must match' });
    expect(msg.tone).toBe('bad');
    expect(msg.text).toBe('Must match');
  });

  it('no plays, kadi chance, suit memory, default', () => {
    expect(turnCoach({ ...base, legalCount: 0 }).text).toMatch(/No playable card/);
    expect(turnCoach({ ...base, kadiReady: true }).text).toMatch(/KADI/);
    expect(turnCoach({ ...base, activeSuit: 'spades', prevSuit: 'hearts', legalCount: 2 }).text)
      .toMatch(/Follow Spades.*was Hearts.*2 playable/);
    expect(turnCoach(base).text).toMatch(/Match 10♥, 3 playable/);
  });

  it('waiting names the owed action and thinking', () => {
    expect(turnCoach({ ...base, myTurn: false, pendingPenalty: 4 }).text)
      .toMatch(/Waiting on Jabari, owes \+4/);
    expect(turnCoach({ ...base, myTurn: false, busyThinking: true }).text)
      .toMatch(/Waiting on Jabari…/);
    expect(turnCoach({ ...base, myTurn: false, request: { rank: 'Q', suit: 'spades' } }).text)
      .toMatch(/must bring Q♠/);
  });

  it('game over names the winner', () => {
    expect(turnCoach({ ...base, gameOver: true, winner: 'You' }).tone).toBe('win');
  });
});
