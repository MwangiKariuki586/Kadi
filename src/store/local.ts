import { del, get, set } from 'idb-keyval';
import { migrateRules, PRESETS, type RulesConfig } from '../engine/rules';
import type { GameState } from '../engine/state';

/** Backend-ready seam: UI only talks to this interface.
 *  v1 = LocalStore. v2 online = SupabaseStore with the same shape. */

export interface Stats {
  games: number;
  wins: number;
  bestStreak: number;
  streak: number;
}

export interface Settings {
  sound: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  presetName: string;
  superAce: boolean;
  /** Beginner turn hints (coach line). Off by default. */
  coach: boolean;
  /** Strict tables: wrong plays are fined + turn passes. Off by default. */
  strict: boolean;
}

export interface ActiveGameMeta {
  numBots: number;
  difficulty: 'easy' | 'medium' | 'hard';
  presetName: string;
  superAce: boolean;
  savedAt: number;
}

export interface ActiveGameSave {
  state: GameState;
  meta: ActiveGameMeta;
}

/** A save is resumable only if it looks like a live, well-formed game. */
export function isResumable(save: unknown): save is ActiveGameSave {
  if (!save || typeof save !== 'object') return false;
  const s = (save as ActiveGameSave).state;
  const m = (save as ActiveGameSave).meta;
  if (!s || typeof s !== 'object' || !m || typeof m !== 'object') return false;
  if (s.gameOver) return false;
  if (!Array.isArray(s.hands) || s.hands.length < 2 || s.hands.length > 5) return false;
  if (!Array.isArray(s.discardPile) || s.discardPile.length === 0) return false;
  if (!Array.isArray(s.drawPile)) return false;
  if (!s.hands.every((h) => Array.isArray(h))) return false;
  if (typeof s.currentPlayer !== 'number' || s.currentPlayer < 0 || s.currentPlayer >= s.hands.length) return false;
  if (!s.config || typeof s.config !== 'object') return false;
  return true;
}

/**
 * Bring a resumed table onto current rules. Saves snapshot their RulesConfig,
 * so a built-in preset would otherwise keep stale flags forever (e.g. the old
 * 2-player J/K-as-question). Re-apply the live preset and keep only the
 * player's own overlays (special-ace mode, strict table). Unknown profiles
 * keep the legacy migrateRules path. Safe mid-match: no question-mode debt
 * persists in state (bare questions draw immediately), so nothing in flight
 * contradicts the refreshed flags.
 */
export function refreshResumeConfig(save: ActiveGameSave): void {
  const preset = PRESETS.find((p) => p.name === save.meta.presetName);
  if (!preset) {
    save.state.config = migrateRules({ ...save.state.config, name: save.state.config.name });
    return;
  }
  save.state.config = {
    ...preset,
    superAceEnabled: save.meta.superAce,
    strictWrongPlay: save.state.config.strictWrongPlay,
  };
}

export interface GameStore {
  getStats(): Promise<Stats>;
  recordResult(won: boolean): Promise<Stats>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Partial<Settings>): Promise<Settings>;
  getCustomRules(): Promise<RulesConfig[]>;
  saveCustomRules(r: RulesConfig): Promise<RulesConfig[]>;
  saveActiveGame(save: ActiveGameSave): Promise<void>;
  loadActiveGame(): Promise<ActiveGameSave | null>;
  clearActiveGame(): Promise<void>;
}

const DEFAULT_STATS: Stats = { games: 0, wins: 0, bestStreak: 0, streak: 0 };
export const DEFAULT_SETTINGS: Settings = { sound: true, difficulty: 'medium', presetName: 'Standard Maua', superAce: false, coach: false, strict: false };

export class LocalStore implements GameStore {
  async getStats(): Promise<Stats> {
    return (await get<Stats>('kadi-stats')) ?? { ...DEFAULT_STATS };
  }

  async recordResult(won: boolean): Promise<Stats> {
    const s = await this.getStats();
    s.games += 1;
    if (won) {
      s.wins += 1;
      s.streak += 1;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
    } else {
      s.streak = 0;
    }
    await set('kadi-stats', s);
    return s;
  }

  async getSettings(): Promise<Settings> {
    const stored = await get<Partial<Settings>>('kadi-settings');
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async saveSettings(s: Partial<Settings>): Promise<Settings> {
    const cur = await this.getSettings();
    const next = { ...cur, ...s };
    await set('kadi-settings', next);
    return next;
  }

  async getCustomRules(): Promise<RulesConfig[]> {
    const raw = (await get<RulesConfig[]>('kadi-rules')) ?? [];
    return raw.map(migrateRules);
  }

  async saveCustomRules(r: RulesConfig): Promise<RulesConfig[]> {
    const cur = await this.getCustomRules();
    const next = [...cur.filter((x) => x.name !== r.name), migrateRules(r)];
    await set('kadi-rules', next);
    return next;
  }

  async saveActiveGame(save: ActiveGameSave): Promise<void> {
    await set('kadi-active-game', save);
  }

  async loadActiveGame(): Promise<ActiveGameSave | null> {
    let raw: unknown;
    try {
      raw = await get('kadi-active-game');
    } catch {
      return null;
    }
    if (!isResumable(raw)) return null;
    // Upgrade stored rules without breaking old saves.
    refreshResumeConfig(raw);
    return raw;
  }

  async clearActiveGame(): Promise<void> {
    try {
      await del('kadi-active-game');
    } catch {
      /* ignore */
    }
  }
}

export const store: GameStore = new LocalStore();
