import type { Difficulty } from "../bots/bot";
import type { RulesConfig } from "../engine/rules";
import type { Settings } from "../store/local";

/**
 * Analytics event catalogue.
 *
 * Keep this list explicit: no autocapture, no pageviews, no free text. Every
 * property here is safe to send to PostHog. User-generated rule names and
 * descriptions never leave the device.
 */

export type AnalyticsScreen =
  | "home"
  | "lobby"
  | "game"
  | "settings"
  | "rules"
  | "howto"
  | "games";

export type PresetKey =
  | "standard_maua"
  | "bom_ni_bom"
  | "backstreet_pesa"
  | "custom";

export type SettingKey =
  | "sound"
  | "difficulty"
  | "preset"
  | "super_ace"
  | "coach"
  | "strict"
  | "jokers"
  | "haptics"
  | "animations"
  | "analytics";

export interface GameConfigProps {
  bots: number;
  difficulty: Difficulty;
  preset: PresetKey;
  jokers: boolean;
  super_ace: boolean;
  strict: boolean;
}

export interface SettingChange {
  key: SettingKey;
  value: string | boolean;
}

export interface AnalyticsEventMap {
  app_opened: {
    display_mode: "standalone" | "browser";
    online: boolean;
    has_saved_game: boolean;
    resumed: boolean;
  };
  screen_viewed: { screen: AnalyticsScreen };
  game_started: GameConfigProps;
  game_resumed: GameConfigProps & { turns: number };
  game_left: GameConfigProps & { saved: boolean; turns: number };
  game_finished: GameConfigProps & {
    won: boolean;
    turns: number;
    duration_ms: number;
    moves: number;
    picks: number;
    invalid_plays: number;
    kadi_calls: number;
    false_kadi: number;
    resumed: boolean;
  };
  move_played: {
    card_count: number;
    turn: number;
    penalty_answer: boolean;
    kept_turn: boolean;
  };
  cards_picked: {
    count: number;
    skipped: boolean;
    turn: number;
  };
  invalid_play: {
    reason: string;
    card_count: number;
    strict: boolean;
    turn: number;
  };
  kadi_called: {
    late: boolean;
    turn: number;
    winnable: boolean;
  };
  kadi_false: {
    turn: number;
    fined: number;
  };
  bot_stall: {
    difficulty: Difficulty;
    card_count: number;
    turn: number;
  };
  setting_changed: SettingChange;
  custom_rules_saved: { editing: boolean };
  custom_rules_deleted: { editing: boolean };
  settings_action: {
    action: "reset_stats" | "clear_save" | "clear_customs" | "clear_history";
  };
  install_prompt_result: {
    outcome: "accepted" | "dismissed" | "unavailable";
    placement: string;
  };
  install_dismissed: { placement: string };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

const PRESET_KEYS: Record<string, PresetKey> = {
  "Standard Maua": "standard_maua",
  "Bom ni Bom": "bom_ni_bom",
  "Backstreet Pesa": "backstreet_pesa",
};

/** Stable key for a rule set. Unknown (user-created) tables are "custom". */
export function presetKey(name: string): PresetKey {
  return PRESET_KEYS[name] ?? "custom";
}

/** Properties that describe the table without exposing a custom rule name. */
export function gameConfigProps(
  config: RulesConfig,
  numBots: number,
  difficulty: Difficulty,
): GameConfigProps {
  return {
    bots: numBots,
    difficulty,
    preset: presetKey(config.name),
    jokers: config.jokersEnabled,
    super_ace: config.superAceEnabled,
    strict: config.strictWrongPlay,
  };
}

/**
 * Map a Settings patch to one event per changed field. Preset names become
 * stable keys. The analytics toggle is only reported when it is switched on,
 * so opting out never produces a network request.
 */
export function settingsChanges(patch: Partial<Settings>): SettingChange[] {
  const changes: SettingChange[] = [];

  if (patch.sound !== undefined) changes.push({ key: "sound", value: patch.sound });
  if (patch.difficulty !== undefined) {
    changes.push({ key: "difficulty", value: patch.difficulty });
  }
  if (patch.presetName !== undefined) {
    changes.push({ key: "preset", value: presetKey(patch.presetName) });
  }
  if (patch.superAce !== undefined) {
    changes.push({ key: "super_ace", value: patch.superAce });
  }
  if (patch.coach !== undefined) changes.push({ key: "coach", value: patch.coach });
  if (patch.strict !== undefined) changes.push({ key: "strict", value: patch.strict });
  if (patch.jokersEnabled !== undefined) {
    changes.push({ key: "jokers", value: patch.jokersEnabled });
  }
  if (patch.haptics !== undefined) {
    changes.push({ key: "haptics", value: patch.haptics });
  }
  if (patch.animations !== undefined) {
    changes.push({ key: "animations", value: patch.animations });
  }
  if (patch.analytics === true) changes.push({ key: "analytics", value: true });

  return changes;
}

/** Standalone (installed) vs browser tab, without relying on user agent. */
export function displayMode(): "standalone" | "browser" {
  if (typeof window === "undefined") return "browser";
  const media = (query: string) =>
    typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return media("(display-mode: standalone)") ||
    media("(display-mode: fullscreen)") ||
    nav.standalone === true
    ? "standalone"
    : "browser";
}
