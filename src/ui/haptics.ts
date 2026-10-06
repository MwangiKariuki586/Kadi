// Haptics: navigator.vibrate on web; Capacitor Haptics later without code change.

export function buzz(pattern: number | number[]): void {
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
