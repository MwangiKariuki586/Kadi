import { afterEach, describe, expect, it, vi } from 'vitest';

const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('install runtime', () => {
  it('does not persist an install from a display-mode change', async () => {
    let mode = 'browser';
    const mediaListeners: Array<() => void> = [];
    const listeners = new Map<string, EventListener>();
    const setItem = vi.fn();
    const storage = {
      getItem: vi.fn(() => null),
      setItem,
    };
    const matchMedia = vi.fn((query: string) => ({
      get matches() {
        return mode !== 'browser' && query === `(display-mode: ${mode})`;
      },
      addEventListener: (_type: string, listener: () => void) => {
        mediaListeners.push(listener);
      },
    }));
    const windowStub = {
      navigator: {
        userAgent: DESKTOP_CHROME,
        platform: 'Win32',
        maxTouchPoints: 0,
      },
      localStorage: storage,
      matchMedia,
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners.set(type, listener);
      }),
    };
    vi.stubGlobal('window', windowStub);
    vi.resetModules();

    const { initInstallPrompt, getInstallSnapshot } = await import('./install');
    initInstallPrompt();
    expect(getInstallSnapshot().installed).toBe(false);

    mode = 'fullscreen';
    for (const listener of mediaListeners) listener();
    expect(getInstallSnapshot().installed).toBe(true);
    expect(setItem).not.toHaveBeenCalled();

    listeners.get('appinstalled')?.(new Event('appinstalled'));
    expect(setItem).toHaveBeenCalledWith('kadi-installed', '1');
  });
});
