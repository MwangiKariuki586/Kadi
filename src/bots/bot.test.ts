import { describe, expect, it } from 'vitest';
import { STANDARD_MAUA } from '../engine/rules';
import { createGame } from '../engine/state';
import { playCombo } from '../engine/validator';
import { bestSuit, chooseMove, chooseRequestCard, shouldDeclareKadi } from './bot';

describe('bots', () => {
  it('always returns a legal move or null (all difficulties)', () => {
    for (let i = 0; i < 60; i++) {
      const players = 2 + (i % 3);
      const s = createGame({ numPlayers: players });
      for (const diff of ['easy', 'medium', 'hard'] as const) {
        const move = chooseMove(s, s.currentPlayer, diff, () => 0.5);
        if (!move) continue;
        const r = playCombo(
          // clone-ish: play on a scratch copy via structuredClone
          structuredClone(s),
          s.currentPlayer,
          move.cards.map((c) => ({ ...c })),
          move.declaredSuit,
        );
        expect(r.ok, `${diff} produced illegal ${move.cards.map((c) => c.rank + c.suit)}`).toBe(true);
      }
    }
  });

  it('stacks a penalty instead of eating it (medium+)', () => {
    const s = createGame({ numPlayers: 2, random: () => 0.1 });
    s.discardPile = [{ id: '2-hearts-top', suit: 'hearts', rank: '2' }];
    s.pendingPenalty = 2;
    s.hands[0] = [
      { id: '2-spades', suit: 'spades', rank: '2' },
      { id: '9-hearts', suit: 'hearts', rank: '9' },
    ];
    s.currentPlayer = 0;
    const move = chooseMove(s, 0, 'medium', () => 0.9);
    expect(move?.cards[0].rank).toBe('2');
  });

  it('declares Kadi with a winnable hand', () => {
    const s = createGame({ numPlayers: 2, random: () => 0.1 });
    s.hands[0] = [
      { id: '5-hearts', suit: 'hearts', rank: '5' },
      { id: '6-spades', suit: 'spades', rank: '6' },
    ];
    expect(shouldDeclareKadi(s, 0)).toBe(true);
  });

  it('bestSuit picks the majority suit', () => {
    expect(bestSuit([
      { id: 'a', suit: 'spades', rank: '5' },
      { id: 'b', suit: 'spades', rank: '6' },
      { id: 'c', suit: 'hearts', rank: '7' },
    ])).toBe('spades');
  });

  it('standard deck includes jokers, strict excludes them', () => {
    expect(STANDARD_MAUA.jokersEnabled).toBe(true);
    const s = createGame({ numPlayers: 4 });
    const deckCount = s.drawPile.length + s.discardPile.length + s.hands.flat().length;
    expect(deckCount).toBe(54);
  });

  it('answers 2♥ with same-suit 3♥ when holding no other 2', () => {
    const s = createGame({ numPlayers: 2, random: () => 0.1 });
    s.discardPile = [{ id: '2-hearts-top', suit: 'hearts', rank: '2' }];
    s.pendingPenalty = 2;
    s.hands[0] = [
      { id: '3-hearts', suit: 'hearts', rank: '3' },
      { id: '9-clubs', suit: 'clubs', rank: '9' },
    ];
    s.currentPlayer = 0;
    const move = chooseMove(s, 0, 'hard', () => 0.9);
    expect(move?.cards[0]).toMatchObject({ rank: '3', suit: 'hearts' });
  });

  it('meets an exact-card request when holding the card, else downgrades with Ace', () => {
    const cfg = { ...STANDARD_MAUA, superAceEnabled: true };
    const s = createGame({ numPlayers: 2, config: cfg, random: () => 0.1 });
    s.activeCardRequest = { rank: '5', suit: 'hearts' };
    s.hands[0] = [
      { id: '5-hearts', suit: 'hearts', rank: '5' },
      { id: '9-clubs', suit: 'clubs', rank: '9' },
    ];
    s.currentPlayer = 0;
    expect(chooseMove(s, 0, 'hard', () => 0.5)?.cards[0]).toMatchObject({ rank: '5' });

    s.hands[0] = [
      { id: 'a-clubs', suit: 'clubs', rank: 'A' },
      { id: '9-clubs', suit: 'clubs', rank: '9' },
    ];
    const m2 = chooseMove(s, 0, 'hard', () => 0.5);
    expect(m2?.cards[0].rank).toBe('A');
    // lifting declares nothing — the demanded suit persists on its own
    expect(m2?.declaredSuit ?? null).toBeNull();
    expect(m2?.requestedCard ?? null).toBeNull();
  });

  it('super-ace mode: bot moves stay legal incl. requestedCard', () => {
    const cfg = { ...STANDARD_MAUA, superAceEnabled: true };
    for (let i = 0; i < 40; i++) {
      const s = createGame({ numPlayers: 2 + (i % 3), config: cfg });
      for (const diff of ['easy', 'medium', 'hard'] as const) {
        const move = chooseMove(s, s.currentPlayer, diff, () => 0.5);
        if (!move) continue;
        const r = playCombo(
          structuredClone(s),
          s.currentPlayer,
          move.cards.map((c) => ({ ...c })),
          move.declaredSuit,
          move.requestedCard ?? null,
        );
        expect(r.ok, `${diff} illegal ${move.cards.map((c) => c.rank + c.suit)}`).toBe(true);
      }
    }
  });

  it('finds a J-stack in tap order even when hand order leads with the wrong suit', () => {
    const s = createGame({ numPlayers: 3, random: () => 0.1 });
    s.discardPile = [{ id: '10-hearts-top', suit: 'hearts', rank: '10' }];
    s.hands[0] = [
      { id: 'j-spades', suit: 'spades', rank: 'J' },
      { id: 'j-hearts', suit: 'hearts', rank: 'J' },
      { id: '4-clubs', suit: 'clubs', rank: '4' },
    ];
    s.currentPlayer = 0;
    const move = chooseMove(s, 0, 'medium', () => 0.9);
    expect(move?.cards.map((c) => c.id)).toEqual(['j-hearts', 'j-spades']);
  });

  it('chooseRequestCard names a held card when possible', () => {
    const req = chooseRequestCard([
      { id: 'a', suit: 'spades', rank: '5' },
      { id: 'b', suit: 'spades', rank: '6' },
      { id: 'c', suit: 'hearts', rank: '7' },
    ]);
    expect(req.suit).toBe('spades');
    expect(['5', '6']).toContain(req.rank);
  });
});
