import { describe, expect, it } from 'vitest';
import { STANDARD_MAUA, STRICT_NO_JOKER } from './rules';
import { createGame, type GameState } from './state';
import { canFinishNow, declareKadi, isSuperAceCombo, legalSingles, passOrPick, playCombo, resolveWrongPlay, validateCombo } from './validator';
import type { Card } from './cards';

const C = (rank: Card['rank'], suit: Card['suit'] = 'hearts', id?: string): Card => ({
  id: id ?? `${rank}-${suit}-${Math.random().toString(36).slice(2, 7)}`,
  suit, rank,
});

function rigged(hand0: Card[], top: Card, rest: Card[] = [], numPlayers = 2, config = STANDARD_MAUA): GameState {
  const s = createGame({ numPlayers, config, random: () => 0.999 });
  s.hands[0] = hand0;
  s.hands[1] = rest.length ? rest : [C('4', 'clubs')];
  s.discardPile = [top];
  s.currentPlayer = 0;
  s.pendingPenalty = 0;
  s.pendingSkip = 0;
  s.activeSuit = null;
  return s;
}

describe('starter + matching', () => {
  it('creates a valid starter (never blacklisted)', () => {
    for (let i = 0; i < 20; i++) {
      const s = createGame({ numPlayers: 3 });
      const top = s.discardPile[0];
      expect(STANDARD_MAUA.starterBlacklist).not.toContain(top.rank);
      expect(s.hands.every((h) => h.length === 4)).toBe(true);
    }
  });

  it('accepts suit or rank match, rejects otherwise', () => {
    const s = rigged([C('5', 'hearts'), C('9', 'clubs')], C('7', 'hearts'));
    expect(validateCombo([s.hands[0][0]], s, 0).ok).toBe(true); // suit
    const s2 = rigged([C('7', 'spades')], C('7', 'hearts'));
    expect(validateCombo([s2.hands[0][0]], s2, 0).ok).toBe(true); // rank
    const s3 = rigged([C('9', 'clubs')], C('7', 'hearts'));
    expect(validateCombo([s3.hands[0][0]], s3, 0)).toMatchObject({ ok: false });
  });
});

describe('question + answer', () => {
  it('Q alone is legal but draws the no-answer obligation', () => {
    const q = C('Q', 'hearts', 'q1');
    const ans = C('5', 'hearts', 'a1');
    const s = rigged([q, ans], C('9', 'hearts'));
    expect(validateCombo([q], s, 0).ok).toBe(true);
    expect(validateCombo([q, ans], s, 0).ok).toBe(true);
    const before = s.hands[0].length;
    playCombo(s, 0, [q]);
    // played 1, drew 1 → hand size unchanged, effect notes the obligation
    expect(s.hands[0].length).toBe(before);
    expect(s.lastEffect).toMatch(/No answer \+1/);
  });

  it('undeclared clean dump is fined, not won and never cardless', () => {
    const q = C('Q', 'hearts', 'q1');
    const ans = C('5', 'hearts', 'a1');
    const s = rigged([q, ans], C('9', 'hearts'), [C('4', 'clubs')]);
    s.drawPile = Array.from({ length: 10 }, (_, i) => C('7', 'diamonds', `d${i}`));
    const r = playCombo(s, 0, [q, ans]);
    expect(r.ok).toBe(true);
    expect(r.won).toBeFalsy();
    expect(r.fined).toBe(1);
    expect(r.becameCardless).toBeFalsy();
    expect(s.gameOver).toBe(false);
    expect(s.hands[0].length).toBe(1); // dumped 2, fined +1
    expect(s.currentPlayer).toBe(1); // turn passes on
    expect(s.lastEffect).toMatch(/No call — fined \+1/);
  });

  it('same-turn declaration is late: fined, not won', () => {
    const fin = C('5', 'hearts', 'f1');
    const s = rigged([fin, C('4', 'clubs', 'k')], C('9', 'hearts'), [C('6', 'spades')]);
    declareKadi(s, 0); // same turn — too late
    s.hands[0] = [fin];
    const r = playCombo(s, 0, [fin]);
    expect(r.won).toBeFalsy();
    expect(r.fined).toBe(1);
    expect(s.gameOver).toBe(false);
  });

  it('declared-earlier clean dump still wins with no fine', () => {
    const q = C('Q', 'hearts', 'q1');
    const ans = C('5', 'hearts', 'a1');
    const s = rigged([q, ans], C('9', 'hearts'), [C('4', 'clubs'), C('6', 'spades')]);
    declareKadi(s, 0);
    s.turnNumber += 1;
    s.currentPlayer = 0;
    const r = playCombo(s, 0, [q, ans]);
    expect(r.won).toBe(true);
    expect(r.fined).toBeFalsy();
    expect(s.gameOver).toBe(true);
  });

  it('custom fine count respected; zero falls back to cardless', () => {
    const cfg = { ...STANDARD_MAUA, lateCallPickCount: 3 };
    const s = rigged([C('5', 'hearts', 'f')], C('9', 'hearts'), [C('4', 'clubs')], 2, cfg);
    s.drawPile = Array.from({ length: 10 }, (_, i) => C('7', 'diamonds', `d${i}`));
    const r = playCombo(s, 0, [s.hands[0][0]]);
    expect(r.fined).toBe(3);
    expect(s.hands[0].length).toBe(3);

    const cfg0 = { ...STANDARD_MAUA, lateCallPickCount: 0 };
    const s0 = rigged([C('5', 'hearts', 'f0')], C('9', 'hearts'), [C('4', 'clubs')], 2, cfg0);
    const r0 = playCombo(s0, 0, [s0.hands[0][0]]);
    expect(r0.fined).toBeFalsy();
    expect(r0.becameCardless).toBe(true);
  });

  it('stacked open questions draw once', () => {
    const q1 = C('Q', 'hearts', 'q1');
    const q2 = C('8', 'hearts', 'q2');
    const s = rigged([q1, q2, C('4', 'clubs', 'k')], C('Q', 'spades'));
    expect(validateCombo([q1, q2], s, 0).ok).toBe(true);
    playCombo(s, 0, [q1, q2]);
    expect(s.hands[0].length).toBe(2); // played 2, drew 1 → 3 - 2 + 1
  });

  it('custom obligation count is respected', () => {
    const cfg = { ...STANDARD_MAUA, unansweredQuestionPickCount: 3 };
    const q = C('8', 'hearts', 'q1');
    const s = rigged([q, C('4', 'clubs', 'k')], C('8', 'spades'), [], 2, cfg);
    playCombo(s, 0, [q]);
    expect(s.hands[0].length).toBe(2 - 1 + 3);
    expect(s.lastEffect).toMatch(/No answer \+3/);
  });

  it('Q + wrong-suit answer is illegal when mustAnswerSameSuit', () => {
    const q = C('8', 'hearts', 'q1');
    const ans = C('5', 'spades', 'a1');
    const s = rigged([q, ans], C('Q', 'hearts'));
    expect(validateCombo([q, ans], s, 0).ok).toBe(false);
  });
});

describe('penalties', () => {
  it('2 sets pending penalty; answering replaces the debt (top takes over)', () => {
    const two = C('2', 'hearts', 't1');
    const s = rigged([two], C('9', 'hearts'), [C('2', 'spades', 't2')]);
    expect(playCombo(s, 0, [two]).ok).toBe(true);
    expect(s.pendingPenalty).toBe(2);
    // next player answers with their own 2 — debt becomes 2, not 4
    const stacked = playCombo(s, 1, [s.hands[1][0]]);
    expect(stacked.ok).toBe(true);
    expect(s.pendingPenalty).toBe(2);
  });

  it('joker answered by a 2 drops the debt to 2 (latest takes over)', () => {
    const red: Card = { id: 'JOKER-1', suit: 'none', rank: 'JOKER' };
    const s = rigged([red], C('9', 'hearts'), [C('2', 'hearts', 't2')]);
    expect(playCombo(s, 0, [red]).ok).toBe(true);
    expect(s.pendingPenalty).toBe(5);
    expect(playCombo(s, 1, [s.hands[1][0]]).ok).toBe(true);
    expect(s.pendingPenalty).toBe(2);
  });

  it('two penalties dropped together count once (latest wins)', () => {
    const s = rigged(
      [C('2', 'hearts', 't1'), C('2', 'spades', 't2')],
      C('9', 'hearts'),
      [C('4', 'clubs')],
    );
    expect(playCombo(s, 0, [s.hands[0][0], s.hands[0][1]]).ok).toBe(true);
    expect(s.pendingPenalty).toBe(2);
  });

  it('Ace blocks penalty', () => {
    const two = C('2', 'hearts', 't1');
    const ace = C('A', 'spades', 'a1');
    const s = rigged([two], C('9', 'hearts'), [ace]);
    playCombo(s, 0, [two]);
    expect(playCombo(s, 1, [ace], 'spades').ok).toBe(true);
    expect(s.pendingPenalty).toBe(0);
  });

  it('Ace block calls nothing — a passed suit is ignored', () => {
    const two = C('2', 'hearts', 't1');
    const ace = C('A', 'hearts', 'a1');
    const s = rigged([two], C('9', 'hearts'), [ace]);
    playCombo(s, 0, [two]);
    playCombo(s, 1, [ace], 'spades');
    expect(s.pendingPenalty).toBe(0);
    expect(s.activeSuit).toBeNull();
    expect(s.activeCardRequest).toBeNull();
    expect(s.lastEffect).toMatch(/^Blocked!/);
  });

  it('strict differs from standard only by jokers — stacking still allowed', () => {
    const two = C('2', 'hearts', 't1');
    const s = rigged([two], C('9', 'hearts'), [C('3', 'hearts', 't2')], 2, STRICT_NO_JOKER);
    playCombo(s, 0, [two]);
    expect(s.pendingPenalty).toBe(2);
    // same-suit 3 answers the 2 even in strict — debt becomes 3, not 5
    expect(playCombo(s, 1, [s.hands[1][0]]).ok).toBe(true);
    expect(s.pendingPenalty).toBe(3);
  });

  it('eating a penalty draws the exact owed count', () => {
    const s = rigged([C('2', 'hearts', 't')], C('9', 'hearts'), [C('4', 'clubs', 'o')], 2);
    s.drawPile = Array.from({ length: 20 }, (_, i) => C('7', 'clubs', `d${i}`));
    playCombo(s, 0, [s.hands[0][0]]);
    const before = s.hands[1].length;
    const r = passOrPick(s, 1);
    expect(r.picked).toBe(2);
    expect(s.hands[1].length).toBe(before + 2);
    expect(s.pendingPenalty).toBe(0);
    expect(s.lastEffect).toBe('Picked 2');
  });

  it('eating after an answer draws the latest count, not the sum', () => {
    const s = rigged([C('2', 'hearts', 't')], C('9', 'hearts'), [C('3', 'hearts', 's3'), C('4', 'clubs', 'o')], 2);
    s.drawPile = Array.from({ length: 20 }, (_, i) => C('7', 'clubs', `d${i}`));
    playCombo(s, 0, [s.hands[0][0]]); // pending 2
    playCombo(s, 1, [s.hands[1][0]]); // answered with 3 → pending 3
    expect(s.pendingPenalty).toBe(3);
    const before = s.hands[0].length;
    const r = passOrPick(s, 0);
    expect(r.picked).toBe(3);
    expect(s.hands[0].length).toBe(before + 3);
  });
});

describe('jump + kickback', () => {
  it('J skips next player (3P table)', () => {
    const s = createGame({ numPlayers: 3, random: () => 0.5 });
    const j: Card = C('J', s.discardPile[0].suit === 'hearts' ? 'hearts' : s.discardPile[0].suit, 'j1');
    // force match: give current player a matching card by suit
    j.suit = s.discardPile[0].suit;
    s.hands[0] = [j, C('4', 'clubs', 'x1')];
    const cur = s.currentPlayer;
    playCombo(s, cur, [j]);
    expect(s.pendingSkip).toBe(0); // consumed by advanceTurn
    expect(s.currentPlayer).toBe((cur + 2) % 3); // skipped one
  });

  it('K reverses direction', () => {
    const s = createGame({ numPlayers: 3, random: () => 0.5 });
    const top = s.discardPile[0];
    const k: Card = C('K', top.suit, 'k1');
    s.hands[0] = [k, C('4', 'clubs', 'x1')];
    const dir = s.direction;
    playCombo(s, 0, [k]);
    expect(s.direction).toBe((dir * -1) as 1 | -1);
  });

  it('2P: J acts as question — playable bare (with draw) or answered (free)', () => {
    const j = C('J', 'hearts', 'j1');
    const s = rigged([j], C('9', 'hearts'), [C('4', 'clubs')], 2, STANDARD_MAUA);
    expect(validateCombo([j], s, 0).ok).toBe(true);
    const ans = C('5', 'hearts', 'a1');
    s.hands[0].push(ans);
    expect(validateCombo([j, ans], s, 0).ok).toBe(true);
    const before = s.hands[0].length;
    playCombo(s, 0, [j]);
    expect(s.hands[0].length).toBe(before); // played 1, drew 1
    expect(s.pendingSkip).toBe(0); // 2P: no skip effect, treated as question
  });
});

describe('winning — Niko Kadi', () => {
  it('must declare Kadi on an earlier turn and finish on winning card', () => {
    const fin = C('5', 'hearts', 'f1');
    const s = rigged([fin], C('9', 'hearts'), [C('4', 'clubs'), C('6', 'spades')]);
    // no Kadi call: empties hand but does NOT win (becomes cardless)
    const r1 = playCombo(s, 0, [fin]);
    expect(r1.won).toBeFalsy();
    expect(s.gameOver).toBe(false);
  });

  it('Kadi declared previous turn + winning finish = win', () => {
    const keep = C('4', 'clubs', 'k1');
    const fin = C('5', 'hearts', 'f1');
    const s = rigged([keep, fin], C('9', 'hearts'), [C('6', 'spades'), C('7', 'clubs')]);
    declareKadi(s, 0);
    // play non-final first to advance a turn
    s.currentPlayer = 0;
    s.turnNumber += 1;
    s.hands[0] = [fin];
    const r = playCombo(s, 0, [fin]);
    expect(r.won).toBe(true);
    expect(s.gameOver).toBe(true);
    expect(s.winnerIndex).toBe(0);
  });

  it('cannot finish on J/K/A/2/3', () => {
    const j = C('4', 'clubs', 'keep');
    void j;
    const s = createGame({ numPlayers: 3, random: () => 0.5 });
    // force: single J matching top as last card, with Kadi declared
    const top = s.discardPile[0];
    const last: Card = C('J', top.suit, 'last');
    s.hands[0] = [last];
    s.hands[1] = [C('4', 'clubs', 'o1')];
    s.hands[2] = [C('5', 'spades', 'o2')];
    declareKadi(s, 0);
    s.turnNumber += 1;
    // 3P so J is a real jump, but J is not a winning rank -> no win
    const r = playCombo(s, 0, [last]);
    expect(r.won).toBeFalsy();
  });

  it('cardless blocker: no win while someone is cardless', () => {
    const fin = C('5', 'hearts', 'f1');
    const s = rigged([fin], C('9', 'hearts'), [C('4', 'clubs')]);
    s.hands.push([]); // third player cardless
    declareKadi(s, 0);
    s.turnNumber += 1;
    const r = playCombo(s, 0, [fin]);
    expect(r.won).toBeFalsy();
  });
});

describe('hints', () => {  it('legalSingles only returns playable cards', () => {
    const s = rigged([C('5', 'hearts', 'a'), C('9', 'clubs', 'b')], C('7', 'hearts'));
    const legal = legalSingles(s, 0);
    expect(legal.map((c) => c.id)).toEqual(['a']);
  });
});

describe('strict wrong-play', () => {
  it('casual tables reject free: no draw, no advance', () => {
    const s = rigged([C('5', 'hearts', 'a'), C('4', 'clubs', 'k')], C('9', 'clubs'), [C('6', 'spades')]);
    expect(resolveWrongPlay(s, 0)).toBe(0);
    expect(s.hands[0].length).toBe(2);
    expect(s.currentPlayer).toBe(0);
  });

  it('strict tables draw the fine and pass the turn', () => {
    const cfg = { ...STANDARD_MAUA, strictWrongPlay: true };
    const s = rigged([C('5', 'hearts', 'a'), C('4', 'clubs', 'k')], C('9', 'clubs'), [C('6', 'spades')], 2, cfg);
    s.drawPile = Array.from({ length: 10 }, (_, i) => C('7', 'diamonds', `d${i}`));
    expect(resolveWrongPlay(s, 0)).toBe(1);
    expect(s.hands[0].length).toBe(3);
    expect(s.currentPlayer).toBe(1);
  });
});

describe('canFinishNow (live KADI! threat)', () => {
  function declared(s: GameState, p: number): GameState {
    declareKadi(s, p);
    s.turnNumber += 1;
    s.currentPlayer = p;
    return s;
  }

  it('true for a single winning card declared on an earlier turn', () => {
    const s = declared(rigged([C('5', 'hearts', 'f')], C('9', 'hearts'), [C('4', 'clubs')]), 0);
    expect(canFinishNow(s, 0)).toBe(true);
  });

  it('false without a declaration, or declared on the same turn', () => {
    const s = rigged([C('5', 'hearts', 'f')], C('9', 'hearts'), [C('4', 'clubs')]);
    expect(canFinishNow(s, 0)).toBe(false);
    declareKadi(s, 0); // same turn — not yet eligible
    expect(canFinishNow(s, 0)).toBe(false);
  });

  it('false while a penalty or skip debt is outstanding', () => {
    const s = declared(rigged([C('5', 'hearts', 'f')], C('9', 'hearts'), [C('4', 'clubs')]), 0);
    s.pendingPenalty = 2;
    expect(canFinishNow(s, 0)).toBe(false);
    s.pendingPenalty = 0;
    s.pendingSkip = 1;
    expect(canFinishNow(s, 0)).toBe(false);
  });

  it('bare question cannot close; answered question can', () => {
    const lone = declared(rigged([C('Q', 'hearts', 'q')], C('9', 'hearts'), [C('4', 'clubs')]), 0);
    expect(canFinishNow(lone, 0)).toBe(false);
    const answered = declared(
      rigged([C('Q', 'hearts', 'q'), C('5', 'hearts', 'a')], C('9', 'hearts'), [C('4', 'clubs')]),
      0,
    );
    expect(canFinishNow(answered, 0)).toBe(true);
  });

  it('finds the winning order regardless of hand order', () => {
    // Hand order leads with the answer, but only Q-first closes the game.
    const s = declared(
      rigged([C('5', 'hearts', 'a'), C('Q', 'hearts', 'q')], C('9', 'hearts'), [C('4', 'clubs')]),
      0,
    );
    expect(canFinishNow(s, 0)).toBe(true);
  });

  it('false with a cardless blocker or an oversized hand', () => {
    const s = declared(rigged([C('5', 'hearts', 'f')], C('9', 'hearts'), [C('4', 'clubs')]), 0);
    s.hands.push([]);
    expect(canFinishNow(s, 0)).toBe(false);
    s.hands.pop();
    s.hands[0] = Array.from({ length: 8 }, (_, i) => C('5', 'hearts', `w${i}`));
    expect(canFinishNow(s, 0)).toBe(false);
  });

  it('true through a declared suit and through an exact-card demand', () => {
    const suited = declared(rigged([C('5', 'spades', 'f')], C('9', 'hearts'), [C('4', 'clubs')]), 0);
    suited.activeSuit = 'spades';
    expect(canFinishNow(suited, 0)).toBe(true);

    const demanded = declared(rigged([C('5', 'hearts', 'f')], C('9', 'clubs'), [C('4', 'clubs')]), 0);
    demanded.activeCardRequest = { rank: '5', suit: 'hearts' };
    expect(canFinishNow(demanded, 0)).toBe(true);

    const aceOnly = declared(rigged([C('A', 'clubs', 'a')], C('9', 'clubs'), [C('4', 'clubs')]), 0);
    aceOnly.activeCardRequest = { rank: '5', suit: 'hearts' };
    expect(canFinishNow(aceOnly, 0)).toBe(false);
  });
});

describe('tap-order K/J stacks', () => {
  it('stack may start with the matching suit even if tap order differs from hand order', () => {
    // Screenshot repro: top 10♥, hand holds J♠ + J♥. J♥-first is legal, J♠-first is not.
    const js = C('J', 'spades', 'js');
    const jh = C('J', 'hearts', 'jh');
    const s = rigged([js, jh], C('10', 'hearts'), [C('4', 'clubs')], 3);
    expect(validateCombo([jh, js], s, 0).ok).toBe(true);
    expect(validateCombo([js, jh], s, 0)).toMatchObject({ ok: false, reason: 'NO_MATCH' });
  });

  it('K stack chains rank after a suit-matching lead', () => {
    const kd = C('K', 'diamonds', 'kd');
    const ks = C('K', 'spades', 'ks');
    const s = rigged([kd, ks, C('4', 'clubs', 'k')], C('10', 'diamonds'), [C('4', 'hearts')], 3);
    expect(validateCombo([kd, ks], s, 0).ok).toBe(true);
  });

  it('J+J final calculation: skip 2 in 3P anti-clockwise returns to self', () => {
    const js = C('J', 'spades', 'js');
    const jh = C('J', 'hearts', 'jh');
    const s = rigged([jh, js], C('10', 'hearts'), [C('4', 'clubs')], 3);
    s.direction = -1;
    s.currentPlayer = 0;
    const r = playCombo(s, 0, [jh, js]);
    expect(r.ok).toBe(true);
    expect(s.currentPlayer).toBe(0); // skipped both rivals
    expect(s.lastEffect).toMatch(/Jump/);
  });

  it('K+K final calculation: double reverse restores direction, turn passes on', () => {
    const kd = C('K', 'diamonds', 'kd');
    const ks = C('K', 'spades', 'ks');
    const s = rigged([kd, ks, C('4', 'clubs', 'k')], C('10', 'diamonds'), [C('4', 'hearts')], 3);
    s.direction = 1;
    s.currentPlayer = 0;
    expect(playCombo(s, 0, [kd, ks]).ok).toBe(true);
    expect(s.direction).toBe(1);
    expect(s.currentPlayer).toBe(1);
  });

  it('mixed K+J stack: reverse applies and one player is skipped', () => {
    const kh = C('K', 'hearts', 'kh');
    const jh = C('J', 'hearts', 'jh');
    const s = rigged([kh, jh, C('4', 'clubs', 'k')], C('10', 'hearts'), [C('4', 'spades')], 3);
    s.direction = 1;
    s.currentPlayer = 0;
    expect(playCombo(s, 0, [kh, jh]).ok).toBe(true);
    expect(s.direction).toBe(-1);
    // 1 + 1 skip, reversed: (0 - 2) mod 3 = 1
    expect(s.currentPlayer).toBe(1);
  });
});

describe('penalty color family', () => {
  const JOKER_RED: Card = { id: 'JOKER-1', suit: 'none', rank: 'JOKER' };
  const JOKER_BLACK: Card = { id: 'JOKER-2', suit: 'none', rank: 'JOKER' };

  it('2♥ answered by 2♠ (rank), 3♥ (suit), red Joker (color)', () => {
    for (const answer of [C('2', 'spades', 'a'), C('3', 'hearts', 'a'), JOKER_RED]) {
      const s = rigged([C('2', 'hearts', 't')], C('9', 'hearts'), [answer], 2);
      playCombo(s, 0, [s.hands[0][0]]);
      expect(playCombo(s, 1, [answer]).ok, answer.id).toBe(true);
    }
  });

  it('rejects non-penalty answers and wrong-color Joker', () => {
    const s = rigged([C('2', 'hearts', 't')], C('9', 'hearts'), [C('5', 'hearts', 'x')], 2);
    playCombo(s, 0, [s.hands[0][0]]);
    expect(validateCombo([s.hands[1][0]], s, 1)).toMatchObject({ ok: false, reason: 'PENALTY_MUST_STACK_OR_BLOCK' });
    expect(validateCombo([JOKER_BLACK], { ...s, hands: [[], [JOKER_BLACK]] }, 1).reason).toBeDefined();
  });

  it('red Joker table answered by red-family penalties or Ace — not black 2♠', () => {
    const table = (ans: Card): boolean => {
      const s = rigged([JOKER_RED], C('9', 'clubs'), [ans], 2);
      s.discardPile = [JOKER_RED];
      s.hands[0] = [];
      s.currentPlayer = 1;
      s.pendingPenalty = 5;
      return validateCombo([ans], s, 1).ok;
    };
    expect(table(C('2', 'hearts', 'a'))).toBe(true);
    expect(table(C('3', 'diamonds', 'b'))).toBe(true);
    expect(table({ ...JOKER_RED, id: 'JOKER-1b' })).toBe(true);
    expect(table(C('2', 'spades', 'c'))).toBe(false);
    expect(table(C('A', 'clubs', 'd'))).toBe(true);
  });
});

describe('super ace', () => {
  const SUPER = { ...STANDARD_MAUA, superAceEnabled: true, name: 'Super' };

  it('mode off: A♠ is a normal suit-request ace', () => {
    const ace = C('A', 'spades', 'as');
    const s = rigged([ace], C('9', 'hearts'), [C('4', 'clubs')], 2, STANDARD_MAUA);
    expect(isSuperAceCombo([ace], s)).toBe(false);
    playCombo(s, 0, [ace], 'clubs');
    expect(s.activeSuit).toBe('clubs');
    expect(s.activeCardRequest).toBeNull();
  });

  it('ace request remembers the suit it overrode', () => {
    const ace = C('A', 'clubs', 'a1');
    const s = rigged([ace], C('9', 'hearts'), [C('4', 'clubs')], 2, STANDARD_MAUA);
    expect(s.lastSuitBeforeRequest).toBeNull();
    playCombo(s, 0, [ace], 'spades');
    expect(s.activeSuit).toBe('spades');
    expect(s.lastSuitBeforeRequest).toBe('hearts');
  });

  it('a second request remembers the previous request, not the table', () => {
    const a1 = C('A', 'clubs', 'a1');
    const a2 = C('A', 'diamonds', 'a2');
    const s = rigged([a1, a2], C('9', 'hearts'), [C('4', 'clubs'), C('5', 'spades')], 2, STANDARD_MAUA);
    playCombo(s, 0, [a1], 'spades');
    expect(s.lastSuitBeforeRequest).toBe('hearts');
    s.currentPlayer = 0;
    s.turnNumber += 1;
    playCombo(s, 0, [a2], 'clubs');
    expect(s.activeSuit).toBe('clubs');
    expect(s.lastSuitBeforeRequest).toBe('spades');
  });

  it('a pure block leaves suit memory untouched', () => {
    const two = C('2', 'hearts', 't1');
    const ace = C('A', 'hearts', 'a1');
    const s = rigged([two], C('9', 'hearts'), [ace]);
    playCombo(s, 0, [two]);
    playCombo(s, 1, [ace], 'spades');
    expect(s.lastSuitBeforeRequest).toBeNull();
  });

  it('A♠ single demands an exact card', () => {
    const ace = C('A', 'spades', 'as');
    const s = rigged([ace], C('9', 'hearts'), [C('5', 'hearts', 'e'), C('6', 'clubs', 'o')], 2, SUPER);
    expect(isSuperAceCombo([ace], s)).toBe(true);
    playCombo(s, 0, [ace], null, { rank: '5', suit: 'hearts' });
    expect(s.activeCardRequest).toEqual({ rank: '5', suit: 'hearts' });
    // exact card satisfies
    expect(playCombo(s, 1, [s.hands[1][0]]).ok).toBe(true);
    expect(s.activeCardRequest).toBeNull();
  });

  it('wrong card under exact request is UNMET; eating draws 1 and clears', () => {
    const ace = C('A', 'spades', 'as');
    const s = rigged([ace], C('9', 'hearts'), [C('6', 'clubs', 'o')], 2, SUPER);
    playCombo(s, 0, [ace], null, { rank: '5', suit: 'hearts' });
    expect(validateCombo([s.hands[1][0]], s, 1)).toMatchObject({ ok: false, reason: 'UNMET_REQUEST' });
    const r = passOrPick(s, 1);
    expect(r.picked).toBe(1);
    expect(s.activeCardRequest).toBeNull();
  });

  it('lone Ace lifts the rank but the demanded suit persists', () => {
    const ace = C('A', 'spades', 'as');
    const downgrade = C('A', 'clubs', 'ac');
    const s = rigged([ace], C('9', 'hearts'), [downgrade, C('4', 'diamonds', 'o')], 2, SUPER);
    playCombo(s, 0, [ace], null, { rank: '5', suit: 'hearts' });
    // responder's diamonds pick is ignored — hearts persists, no fresh call
    playCombo(s, 1, [downgrade], 'diamonds');
    expect(s.activeCardRequest).toBeNull();
    expect(s.activeSuit).toBe('hearts');
    expect(s.lastEffect).toMatch(/Rank lifted/);
  });

  it('single Ace against a suit request still re-declares (last one declares)', () => {
    const ace = C('A', 'diamonds', 'ad');
    const s = rigged([ace, C('4', 'clubs', 'k')], C('9', 'hearts'), [C('4', 'spades')], 2, STANDARD_MAUA);
    s.activeSuit = 'hearts';
    playCombo(s, 0, [ace], 'spades');
    expect(s.activeSuit).toBe('spades');
    expect(s.lastSuitBeforeRequest).toBe('hearts');
  });

  it('super answers super: the new demand replaces the old', () => {
    const a1 = C('A', 'spades', 'a1');
    const a2 = C('A', 'hearts', 'a2');
    const b1 = C('A', 'clubs', 'b1');
    const b2 = C('A', 'diamonds', 'b2');
    const s = rigged([a1, a2, C('4', 'clubs', 'k')], C('7', 'spades'), [b1, b2, C('6', 'clubs', 'o')], 2, STANDARD_MAUA);
    playCombo(s, 0, [a1, a2], null, { rank: '4', suit: 'clubs' });
    playCombo(s, 1, [b1, b2], null, { rank: '9', suit: 'spades' });
    expect(s.activeCardRequest).toEqual({ rank: '9', suit: 'spades' });
    expect(s.activeSuit).toBeNull();
  });

  it('stacked A♥+A♦ is super with or without the mode; single A♥ never is', () => {
    const a1 = C('A', 'hearts', 'a1');
    const a2 = C('A', 'diamonds', 'a2');
    const plain = rigged([a1, a2], C('9', 'hearts'), [C('4', 'clubs')], 2, STANDARD_MAUA);
    expect(isSuperAceCombo([a1], plain)).toBe(false);
    expect(isSuperAceCombo([a1, a2], plain)).toBe(true);
    const s = rigged([a1, a2], C('9', 'hearts'), [C('4', 'clubs')], 2, SUPER);
    expect(isSuperAceCombo([a1], s)).toBe(false);
    expect(isSuperAceCombo([a1, a2], s)).toBe(true);
  });

  it('stacked aces demand an exact card even with the mode off', () => {
    const a1 = C('A', 'spades', 'a1');
    const a2 = C('A', 'hearts', 'a2');
    const s = rigged([a1, a2, C('4', 'clubs', 'k')], C('7', 'spades'), [C('5', 'hearts', 'e')], 2, STANDARD_MAUA);
    playCombo(s, 0, [a1, a2], null, { rank: '5', suit: 'hearts' });
    expect(s.activeCardRequest).toEqual({ rank: '5', suit: 'hearts' });
    expect(s.lastEffect).toMatch(/Bring 5♥/);
  });

  it('full chain: demand → rank lift (suit persists) → bare question on it', () => {
    // Your stacked aces demand 4♣; Jabari lifts with an Ace — clubs persists;
    // Amani plays bare 8♣ on clubs and picks 1. Demand stays dead, suit clears.
    const a1 = C('A', 'spades', 'a1');
    const a2 = C('A', 'hearts', 'a2');
    const s = rigged(
      [a1, a2, C('4', 'spades', 'k')],
      C('7', 'spades'),
      [C('A', 'clubs', 'ac'), C('9', 'clubs', 'x')],
      3,
      STANDARD_MAUA,
    );
    s.hands[2] = [C('8', 'clubs', 'q'), C('5', 'spades', 'o')];
    playCombo(s, 0, [a1, a2], null, { rank: '4', suit: 'clubs' });
    expect(s.activeCardRequest).toEqual({ rank: '4', suit: 'clubs' });

    expect(playCombo(s, 1, [s.hands[1][0]], 'hearts').ok).toBe(true);
    expect(s.activeCardRequest).toBeNull();
    expect(s.activeSuit).toBe('clubs');

    const before = s.hands[2].length;
    expect(playCombo(s, 2, [s.hands[2][0]]).ok).toBe(true);
    expect(s.hands[2].length).toBe(before); // played 1, drew 1
    expect(s.activeSuit).toBeNull();
    expect(s.discardPile[s.discardPile.length - 1]).toMatchObject({ rank: '8', suit: 'clubs' });
  });

  it('super ace blocking a penalty is a pure block — no demand', () => {
    const two = C('2', 'hearts', 't');
    const ace = C('A', 'spades', 'as');
    const s = rigged([two], C('9', 'hearts'), [ace, C('5', 'hearts', 'e')], 2, SUPER);
    playCombo(s, 0, [two]);
    playCombo(s, 1, [ace], null, { rank: '5', suit: 'hearts' });
    expect(s.pendingPenalty).toBe(0);
    expect(s.activeCardRequest).toBeNull();
    expect(s.activeSuit).toBeNull();
  });

  it('stacked aces blocking a penalty call nothing', () => {
    const two = C('2', 'hearts', 't');
    const a1 = C('A', 'spades', 'a1');
    const a2 = C('A', 'hearts', 'a2');
    const s = rigged([two], C('9', 'hearts'), [a1, a2, C('5', 'clubs', 'e')], 2, SUPER);
    playCombo(s, 0, [two]);
    expect(playCombo(s, 1, [a1, a2], null, { rank: '5', suit: 'clubs' }).ok).toBe(true);
    expect(s.pendingPenalty).toBe(0);
    expect(s.activeCardRequest).toBeNull();
    expect(s.activeSuit).toBeNull();
  });
});
