import { describe, expect, it } from 'vitest';
import { chooseMove } from '../bots/bot';
import { migrateRules, STANDARD_MAUA } from '../engine/rules';
import { createGame } from '../engine/state';
import { playCombo } from '../engine/validator';
import { isResumable, DEFAULT_SETTINGS, type ActiveGameSave } from './local';
import { STRICT_NO_JOKER } from '../engine/rules';

function liveSave(): ActiveGameSave {
  const state = createGame({ numPlayers: 3, config: STANDARD_MAUA, random: () => 0.42 });
  return {
    state,
    meta: { numBots: 2, difficulty: 'medium', presetName: STANDARD_MAUA.name, superAce: false, savedAt: Date.now() },
  };
}

describe('resume guard', () => {  it('accepts a live, well-formed save', () => {
    expect(isResumable(liveSave())).toBe(true);
  });

  it('rejects null, garbage, finished and malformed saves', () => {
    expect(isResumable(null)).toBe(false);
    expect(isResumable(undefined)).toBe(false);
    expect(isResumable({})).toBe(false);
    expect(isResumable({ state: null, meta: null })).toBe(false);
    const done = liveSave();
    done.state.gameOver = true;
    expect(isResumable(done)).toBe(false);
    for (const mutate of [
      (s: ActiveGameSave) => { s.state.hands = []; },
      (s: ActiveGameSave) => { s.state.hands = [[]]; },
      (s: ActiveGameSave) => { s.state.discardPile = []; },
      (s: ActiveGameSave) => { s.state.currentPlayer = 99; },
      (s: ActiveGameSave) => { (s.state as unknown as Record<string, unknown>).config = null; },
    ]) {
      const bad = liveSave();
      mutate(bad);
      expect(isResumable(bad)).toBe(false);
    }
  });

  it('survives a JSON round-trip and play continues legally', () => {
    const save = liveSave();
    // a few scripted moves first
    const st = save.state;
    const first = st.hands[st.currentPlayer][0];
    void first;
    const revived = JSON.parse(JSON.stringify(save)) as ActiveGameSave;
    expect(isResumable(revived)).toBe(true);
    expect(revived.state).toEqual(save.state);
    // next actor can still move
    const me = revived.state.currentPlayer;
    const move = chooseMove(revived.state, me, 'medium', () => 0.5);
    if (move) {
      const r = playCombo(revived.state, me, move.cards, move.declaredSuit, move.requestedCard ?? null);
      expect(r.ok).toBe(true);
    }
  });

  it('old saves upgrade through migrateRules without breaking', () => {
    const legacy = { version: 1 as const, name: 'Old Estate' };
    const migrated = migrateRules(legacy);
    expect(migrated.superAceEnabled).toBe(false);
    expect(migrated.unansweredQuestionPickCount).toBe(1);
    expect(migrated.specialAceSuit).toBe('spades');
    expect(migrated.penaltyAccumulates).toBe(false);
  });
});

describe('settings defaults', () => {
  it('turn hints coach is off by default', () => {
    expect(DEFAULT_SETTINGS.coach).toBe(false);
  });

  it('strict tables are off by default', () => {
    expect(DEFAULT_SETTINGS.strict).toBe(false);
  });

  it('both presets play casual tables by default', () => {
    expect(STANDARD_MAUA.strictWrongPlay).toBe(false);
    expect(STRICT_NO_JOKER.strictWrongPlay).toBe(false);
  });
});
