import { describe, expect, it } from 'vitest';
import {
  isWinnableShape,
  passOrPick,
  playCombo,
  tryDeclareKadi,
  validateCombo,
} from '../engine/validator';
import {
  CHOICE_BOARDS,
  PLAY_BOARDS,
  buildPracticeTable,
  tableCards,
  type PlayBoard,
} from './howtoContent';

function playFresh(board: PlayBoard, ids: string[]) {
  const s = buildPracticeTable(board.setup);
  const cards = tableCards(s, ids);
  expect(cards).toHaveLength(ids.length);
  return { s, cards };
}

describe('how to play boards are engine-accurate', () => {
  for (const board of PLAY_BOARDS) {
    it(`${board.id}: every solution is legal`, () => {
      for (const sol of board.solutions) {
        const { s, cards } = playFresh(board, sol);
        expect(validateCombo(cards, s, 0).ok).toBe(true);
      }
    });

    if (board.expect) {
      it(`${board.id}: full move ends as taught (${board.expect})`, () => {
        for (const sol of board.solutions) {
          const { s, cards } = playFresh(board, sol);
          const clone = JSON.parse(JSON.stringify(s));
          const r = playCombo(clone, 0, cards, null, null);
          expect(r.ok).toBe(true);
          if (board.expect === 'win') expect(r.won).toBe(true);
          if (board.expect === 'cardless') expect(r.becameCardless).toBe(true);
          if (board.expect === 'fined') expect(r.fined).toBeGreaterThan(0);
        }
      });
    }

    for (const wrong of board.wrongs) {
      it(`${board.id}: wrong tap fails as taught (${wrong.reason})`, () => {
        const { s, cards } = playFresh(board, wrong.cards);
        const r = validateCombo(cards, s, 0);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe(wrong.reason);
      });
    }

    if (board.kula) {
      it(`${board.id}: kula fallback draws and moves on`, () => {
        const s = buildPracticeTable(board.setup);
        const before = s.hands[0].length;
        const r = passOrPick(s, 0);
        expect(r.picked).toBeGreaterThan(0);
        expect(s.hands[0].length).toBe(before + r.picked);
      });
    }
  }

  it('answer-question: a bare Q is legal but not the lesson', () => {
    const board = PLAY_BOARDS.find((b) => b.id === 'answer-question')!;
    const { s, cards } = playFresh(board, ['Q-spades']);
    expect(validateCombo(cards, s, 0).ok).toBe(true);
    expect(board.solutions.some((sol) => sol.join() === 'Q-spades')).toBe(false);
  });

  it('kadi-shout-now: 5♣ + 5♦ is declarable', () => {
    const board = CHOICE_BOARDS.find((b) => b.id === 'kadi-shout-now')!;
    const s = buildPracticeTable({ top: board.hand[0], hand: board.hand });
    expect(isWinnableShape(s.hands[0], s.config)).toBe(true);
    expect(tryDeclareKadi(s, 0).ok).toBe(true);
  });

  it('kadi-too-early: J♣ + 5♦ is a fined false call', () => {
    const board = CHOICE_BOARDS.find((b) => b.id === 'kadi-too-early')!;
    const s = buildPracticeTable({ top: board.hand[0], hand: board.hand });
    expect(isWinnableShape(s.hands[0], s.config)).toBe(false);
    const r = tryDeclareKadi(s, 0);
    expect(r.ok).toBe(false);
    expect(r.falseCall).toBe(true);
    expect(r.fined).toBe(1);
  });
});
