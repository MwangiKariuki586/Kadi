import { describe, expect, it } from 'vitest';
import { shouldGuardOnExit, type Screen } from './app';
import { createGame } from './engine/state';
import { STANDARD_MAUA } from './engine/rules';

function liveState(): ReturnType<typeof createGame> {
  return createGame({ numPlayers: 2, config: STANDARD_MAUA });
}

describe('shouldGuardOnExit', () => {
  it('guards a live match on the game screen', () => {
    expect(shouldGuardOnExit('game', liveState())).toBe(true);
  });

  it('does not guard after the game is over', () => {
    const done = liveState();
    done.gameOver = true;
    expect(shouldGuardOnExit('game', done)).toBe(false);
  });

  it('does not guard on the home screen', () => {
    expect(shouldGuardOnExit('home', liveState())).toBe(false);
  });

  it('does not guard on non-game screens', () => {
    for (const screen of ['lobby', 'settings', 'rules', 'howto', 'games'] as
      | Screen[]) {
      expect(shouldGuardOnExit(screen, liveState())).toBe(false);
    }
  });

  it('does not guard when no match is loaded', () => {
    expect(shouldGuardOnExit('game', null)).toBe(false);
  });
});
