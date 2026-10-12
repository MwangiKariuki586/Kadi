// Haptics: navigator.vibrate on web; Capacitor Haptics later without code change.

let enabled =
  typeof localStorage === 'undefined' ||
  localStorage.getItem('kadi-haptics-off') !== '1';

export function isHapticsEnabled(): boolean {
  return enabled;
}

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
  try {
    if (on) localStorage.removeItem('kadi-haptics-off');
    else localStorage.setItem('kadi-haptics-off', '1');
  } catch {
    /* private mode — ignore */
  }
}

export function buzz(pattern: number | number[]): void {
  if (!enabled) return;
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* unsupported — ignore */
  }
}

export const haptics = {
  tap: () => buzz(12),
  play: () => buzz(20),
  penalty: () => buzz([40, 40, 40]),
  win: () => buzz([30, 50, 30, 50, 60]),
};
