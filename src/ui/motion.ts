// Motion preference: manual animations override stored in Settings.
// `animations=true` allows motion (OS reduced-motion still wins via CSS).
// `animations=false` forces calm mode via [data-motion="reduced"].

export function motionAttribute(animations: boolean): string {
  return animations ? 'full' : 'reduced';
}

export function applyMotionPreference(animations: boolean): void {
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      if (animations) delete document.documentElement.dataset.motion;
      else document.documentElement.dataset.motion = 'reduced';
    }
  } catch {
    /* DOM unavailable — ignore */
  }
}
