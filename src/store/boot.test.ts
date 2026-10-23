import { describe, expect, it, vi } from 'vitest';
import { STANDARD_MAUA } from '../engine/rules';
import { createGame } from '../engine/state';
import { loadBootData } from './boot';
import { DEFAULT_SETTINGS, type ActiveGameSave, type Settings } from './local';

function liveSave(): ActiveGameSave {
  return {
    state: createGame({ numPlayers: 2, random: () => 0.5 }),
    meta: {
      numBots: 1,
      difficulty: 'medium',
      presetName: STANDARD_MAUA.name,
      superAce: false,
      savedAt: 1,
    },
  };
}

describe('loadBootData', () => {
  it('loads customs and settings before touching the live save', async () => {
    const customs = [{ ...STANDARD_MAUA, name: 'Estate Test' }];
    const settings: Settings = { ...DEFAULT_SETTINGS, presetName: 'Estate Test' };
    const save = liveSave();
    const calls: string[] = [];
    let releaseCustoms!: (value: typeof customs) => void;
    let releaseSettings!: (value: Settings) => void;
    const customsReady = new Promise<typeof customs>((resolve) => {
      releaseCustoms = resolve;
    });
    const settingsReady = new Promise<Settings>((resolve) => {
      releaseSettings = resolve;
    });
    const store = {
      getCustomRules: vi.fn(() => {
        calls.push('customs');
        return customsReady;
      }),
      getSettings: vi.fn(() => {
        calls.push('settings');
        return settingsReady;
      }),
      loadActiveGame: vi.fn(async () => {
        calls.push('save');
        return save;
      }),
    };

    const run = loadBootData(store);
    expect(calls).toEqual(['customs']);
    releaseCustoms(customs);
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual(['customs', 'settings']);
    expect(store.loadActiveGame).not.toHaveBeenCalled();

    releaseSettings(settings);
    await expect(run).resolves.toEqual({ customs, settings, save });
    expect(calls).toEqual(['customs', 'settings', 'save']);
  });

  it('still resumes when settings cannot be read', async () => {
    const save = liveSave();
    const store = {
      getCustomRules: vi.fn(async () => []),
      getSettings: vi.fn(async () => {
        throw new Error('storage blocked');
      }),
      loadActiveGame: vi.fn(async () => save),
    };

    await expect(loadBootData(store)).resolves.toEqual({
      customs: [],
      settings: null,
      save,
    });
  });

  it('returns safe defaults when every read fails', async () => {
    const store = {
      getCustomRules: vi.fn(async () => {
        throw new Error('customs failed');
      }),
      getSettings: vi.fn(async () => {
        throw new Error('settings failed');
      }),
      loadActiveGame: vi.fn(async () => {
        throw new Error('save failed');
      }),
    };

    await expect(loadBootData(store)).resolves.toEqual({
      customs: [],
      settings: null,
      save: null,
    });
  });
});
