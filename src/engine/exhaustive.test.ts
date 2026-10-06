import { describe, expect, it } from 'vitest';
import type { Card, Suit } from '../engine/cards';
import { STANDARD_MAUA } from '../engine/rules';
import { createGame, type GameState } from '../engine/state';
import { validateCombo } from '../engine/validator';

const C = (rank: Card['rank'], suit: Card['suit'], id: string): Card => ({ id, suit, rank });

const RANKS: Card['rank'][] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS: Suit[] = ['hearts', 'diamonds', 'spades', 'clubs'];

/** A combo whose chain is broken (4♦ matches neither suit nor rank of 2♣). */
const BROKEN = [C('2', 'clubs', 'c2'), C('4', 'diamonds', 'd4')];

function stateWith(opts: {
  top: Card; pending: number; skip: number;
  suit: Suit | null; req: { rank: Card['rank']; suit: Suit } | null;
}): GameState {
  const s = createGame({ numPlayers: 3, config: STANDARD_MAUA, random: () => 0.5 });
  s.hands[1] = [C('2', 'clubs', 'c2'), C('4', 'diamonds', 'd4'), C('9', 'spades', 'filler')];
  s.hands[0] = [C('5', 'hearts', 'h0')];
  s.hands[2] = [C('6', 'hearts', 'h2')];
  s.discardPile = [opts.top];
  s.currentPlayer = 1;
  s.pendingPenalty = opts.pending;
  s.pendingSkip = opts.skip;
  s.activeSuit = opts.suit;
  s.activeCardRequest = opts.req;
  return s;
}

describe('exhaustive: broken chain [2♣,4♦] is rejected in EVERY table state', () => {
  it('never validates, across tops × debts × suits × demands × skips', () => {
    const tops: Card[] = [];
    for (const r of RANKS) for (const st of SUITS) tops.push(C(r, st, `t-${r}-${st}`));
    tops.push({ id: 'JOKER-1', suit: 'none', rank: 'JOKER' }, { id: 'JOKER-2', suit: 'none', rank: 'JOKER' });
    const reqs: ({ rank: Card['rank']; suit: Suit } | null)[] = [
      null,
      { rank: '2', suit: 'clubs' },
      { rank: '4', suit: 'diamonds' },
      { rank: '5', suit: 'hearts' },
    ];
    const suits: (Suit | null)[] = [null, ...SUITS];
    let checked = 0;
    for (const top of tops) {
      for (const pending of [0, 2, 3, 5, 9]) {
        for (const skip of [0, 1, 2]) {
          for (const suit of suits) {
            for (const req of reqs) {
              const s = stateWith({ top, pending, skip, suit, req });
              const res = validateCombo(BROKEN, s, 1);
              expect(res.ok, JSON.stringify({ top: top.id, pending, skip, suit, req })).toBe(false);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });
});
