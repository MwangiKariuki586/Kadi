import { describe, expect, it } from "vitest";
import { PRESETS, STANDARD_MAUA, type RulesConfig } from "../engine/rules";
import {
  displayMode,
  gameConfigProps,
  presetKey,
  settingsChanges,
} from "./events";
import {
  buildPostHogConfig,
  resolveAnalyticsConfig,
} from "./client";

const customConfig: RulesConfig = {
  ...STANDARD_MAUA,
  name: "Sunday Table",
  jokersEnabled: false,
  superAceEnabled: true,
  strictWrongPlay: true,
};

describe("presetKey", () => {
  it("maps every built-in preset to a stable key", () => {
    for (const preset of PRESETS) {
      expect(presetKey(preset.name)).not.toBe("custom");
    }
  });

  it("maps user-created rules to custom", () => {
    expect(presetKey("Sunday Table")).toBe("custom");
    expect(presetKey("")).toBe("custom");
  });
});

describe("gameConfigProps", () => {
  it("describes a built-in table without exposing the name", () => {
    expect(gameConfigProps(STANDARD_MAUA, 2, "hard")).toEqual({
      bots: 2,
      difficulty: "hard",
      preset: "standard_maua",
      jokers: STANDARD_MAUA.jokersEnabled,
      super_ace: STANDARD_MAUA.superAceEnabled,
      strict: STANDARD_MAUA.strictWrongPlay,
    });
  });

  it("describes a custom table as custom", () => {
    const props = gameConfigProps(customConfig, 3, "easy");
    expect(props.preset).toBe("custom");
    expect(props).not.toHaveProperty("name");
    expect(props.jokers).toBe(false);
    expect(props.super_ace).toBe(true);
    expect(props.strict).toBe(true);
  });
});

describe("settingsChanges", () => {
  it("maps each changed field to a stable key", () => {
    expect(
      settingsChanges({
        sound: false,
        difficulty: "easy",
        presetName: "Bom ni Bom",
        superAce: true,
        coach: true,
        strict: true,
        jokersEnabled: false,
        haptics: false,
        animations: false,
      }),
    ).toEqual([
      { key: "sound", value: false },
      { key: "difficulty", value: "easy" },
      { key: "preset", value: "bom_ni_bom" },
      { key: "super_ace", value: true },
      { key: "coach", value: true },
      { key: "strict", value: true },
      { key: "jokers", value: false },
      { key: "haptics", value: false },
      { key: "animations", value: false },
    ]);
  });

  it("never reports opting out, but reports opting back in", () => {
    expect(settingsChanges({ analytics: false })).toEqual([]);
    expect(settingsChanges({ analytics: true })).toEqual([
      { key: "analytics", value: true },
    ]);
  });

  it("ignores unchanged fields", () => {
    expect(settingsChanges({})).toEqual([]);
  });
});

describe("displayMode", () => {
  it("falls back to browser outside a DOM", () => {
    expect(displayMode()).toBe("browser");
  });
});

describe("resolveAnalyticsConfig", () => {
  const env = {
    VITE_POSTHOG_KEY: "phc_test",
    VITE_POSTHOG_HOST: "https://us.i.posthog.com/",
  };

  it("requires a project key", () => {
    expect(
      resolveAnalyticsConfig({}, { dev: false }),
    ).toBeNull();
    expect(
      resolveAnalyticsConfig({ VITE_POSTHOG_KEY: "   " }, { dev: false }),
    ).toBeNull();
  });

  it("stays silent in dev unless explicitly enabled", () => {
    expect(resolveAnalyticsConfig(env, { dev: true })).toBeNull();
    expect(
      resolveAnalyticsConfig({ ...env, VITE_POSTHOG_DEV: "false" }, { dev: true }),
    ).toBeNull();
    expect(
      resolveAnalyticsConfig({ ...env, VITE_POSTHOG_DEV: "true" }, { dev: true }),
    ).toEqual({ key: "phc_test", host: "https://us.i.posthog.com" });
  });

  it("uses production config without the dev flag", () => {
    expect(resolveAnalyticsConfig(env, { dev: false })).toEqual({
      key: "phc_test",
      host: "https://us.i.posthog.com",
    });
  });

  it("defaults to US Cloud and strips trailing slashes", () => {
    expect(
      resolveAnalyticsConfig({ VITE_POSTHOG_KEY: "phc_test" }, { dev: false }),
    ).toEqual({ key: "phc_test", host: "https://us.i.posthog.com" });
    expect(
      resolveAnalyticsConfig(
        { VITE_POSTHOG_KEY: "phc_test", VITE_POSTHOG_HOST: "https://eu.i.posthog.com//" },
        { dev: false },
      ),
    ).toEqual({ key: "phc_test", host: "https://eu.i.posthog.com" });
  });

  it("honours Do Not Track", () => {
    expect(
      resolveAnalyticsConfig(env, { dev: false, doNotTrack: true }),
    ).toBeNull();
  });

  it("stays silent under browser automation", () => {
    expect(
      resolveAnalyticsConfig(env, { dev: false, automation: true }),
    ).toBeNull();
  });
});

describe("buildPostHogConfig", () => {
  const config = buildPostHogConfig("https://us.i.posthog.com");

  it("disables every automatic capture surface", () => {
    expect(config.autocapture).toBe(false);
    expect(config.capture_pageview).toBe(false);
    expect(config.capture_pageleave).toBe(false);
    expect(config.capture_dead_clicks).toBe(false);
    expect(config.capture_heatmaps).toBe(false);
    expect(config.capture_performance).toBe(false);
    expect(config.capture_exceptions).toBe(false);
    expect(config.disable_surveys).toBe(true);
    expect(config.rageclick).toBe(false);
  });

  it("keeps analytics anonymous and first-party", () => {
    expect(config.person_profiles).toBe("never");
    expect(config.persistence).toBe("localStorage");
    expect(config.cross_subdomain_cookie).toBe(false);
    expect(config.ip).toBe(false);
    expect(config.respect_dnt).toBe(true);
    expect(config.opt_out_capturing_by_default).toBe(true);
  });

  it("enables replay with input and custom-text masking", () => {
    expect(config.disable_session_recording).toBe(false);
    expect(config.session_recording?.maskAllInputs).toBe(true);
    expect(config.session_recording?.maskTextSelector).toBe("[data-ph-mask]");
    expect(config.session_recording?.recordBody).toBe(false);
    expect(config.session_recording?.recordHeaders).toBe(false);
  });

  it("does not disable flags, which replay depends on", () => {
    expect(config.advanced_disable_flags).toBeUndefined();
  });
});
