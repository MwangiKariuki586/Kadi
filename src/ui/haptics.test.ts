import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadHaptics() {
  vi.resetModules();
  return import('./haptics');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('haptics boot', () => {
  it('stays enabled when storage access throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('storage blocked');
      },
    });

    const { isHapticsEnabled } = await loadHaptics();
    expect(isHapticsEnabled()).toBe(true);
  });

  it('honours a stored off switch', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => '1'),
    });

    const { isHapticsEnabled } = await loadHaptics();
    expect(isHapticsEnabled()).toBe(false);
  });
});
