import { describe, expect, it } from "vitest";
import { PRESETS, STANDARD_MAUA, type RulesConfig } from "../engine/rules";
import {
  customRuleChanges,
  displayMode,
  gameConfigProps,
  presetKey,
  settingsChanges,
  type AnalyticsEventName,
} from "./events";
import {
  buildPostHogConfig,
  guardRetryQueue,
  REPLAY_SAMPLE_RATE,
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

describe("customRuleChanges", () => {
  it("reports only structured fields that differ", () => {
    const next: RulesConfig = {
      ...STANDARD_MAUA,
      jokersEnabled: false,
      penaltyMatchMode: "any",
      penaltyPicks: { "2": 4, "3": 3 },
    };

    expect(customRuleChanges(STANDARD_MAUA, next)).toEqual([
      { field: "jokersEnabled", value: "false" },
      { field: "penaltyPicks", value: "2:4,3:3" },
      { field: "penaltyMatchMode", value: "any" },
    ]);
  });

  it("does not report the Joker pick when Jokers are toggled", () => {
    const noJokers: RulesConfig = {
      ...STANDARD_MAUA,
      jokersEnabled: false,
      penaltyPicks: { "2": 2, "3": 3 },
    };
    expect(customRuleChanges(STANDARD_MAUA, noJokers)).toEqual([
      { field: "jokersEnabled", value: "false" },
    ]);
    expect(customRuleChanges(noJokers, STANDARD_MAUA)).toEqual([
      { field: "jokersEnabled", value: "true" },
    ]);
  });

  it("treats rank lists as sets", () => {
    const next: RulesConfig = {
      ...STANDARD_MAUA,
      questionRanks: [...STANDARD_MAUA.questionRanks].reverse(),
    };

    expect(customRuleChanges(STANDARD_MAUA, next)).toEqual([]);
  });

  it("never reports name, description, or version", () => {
    const next: RulesConfig = {
      ...STANDARD_MAUA,
      name: "Sunday Table",
      description: "Family rules",
      version: 99,
    };

    expect(customRuleChanges(STANDARD_MAUA, next)).toEqual([]);
  });

  it("serializes numbers and booleans as stable strings", () => {
    const next: RulesConfig = {
      ...STANDARD_MAUA,
      dealCount: 7,
      strictWrongPlay: true,
    };

    expect(customRuleChanges(STANDARD_MAUA, next)).toEqual([
      { field: "dealCount", value: "7" },
      { field: "strictWrongPlay", value: "true" },
    ]);
  });
});

describe("displayMode", () => {
  it("falls back to browser outside a DOM", () => {
    expect(displayMode()).toBe("browser");
  });
});

describe("event budget", () => {
  it("does not capture per-turn move or pick events", () => {
    // Compile-time guard: reintroducing either event fails `tsc -b`.
    type Removed = Extract<AnalyticsEventName, "move_played" | "cards_picked">;
    const removed: [Removed] extends [never] ? true : false = true;
    expect(removed).toBe(true);
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

  it("samples replay to stay within the recording quota", () => {
    expect(REPLAY_SAMPLE_RATE).toBeGreaterThan(0);
    expect(REPLAY_SAMPLE_RATE).toBeLessThan(1);
    expect(config.session_recording?.sampleRate).toBe(REPLAY_SAMPLE_RATE);
  });

  it("enables replay with input and custom-text masking", () => {
    expect(config.disable_session_recording).toBe(false);
    expect(config.session_recording?.maskAllInputs).toBe(true);
    expect(config.session_recording?.maskTextSelector).toBe("[data-ph-mask]");
    expect(config.session_recording?.recordBody).toBe(false);
    expect(config.session_recording?.recordHeaders).toBe(false);
  });

  it("sends events immediately so nothing is queued across an opt-out", () => {
    expect(config.request_batching).toBe(false);
  });

  it("does not disable flags, which replay depends on", () => {
    expect(config.advanced_disable_flags).toBeUndefined();
  });
});

describe("guardRetryQueue", () => {
  type GuardTarget = Parameters<typeof guardRetryQueue>[0];

  function fakeQueue() {
    const calls = { enqueue: 0, flush: 0, unload: 0 };
    const queue = {
      _queue: [{ url: "/e" }] as unknown[],
      _isPolling: true,
      _poller: 123 as unknown as ReturnType<typeof setTimeout>,
      _enqueue: (_requestOptions: unknown, _retryAfterMs?: number) => {
        calls.enqueue += 1;
      },
      _flush: () => {
        calls.flush += 1;
      },
      unload: () => {
        calls.unload += 1;
      },
    };
    return { queue, calls };
  }

  function guard(
    queue: ReturnType<typeof fakeQueue>["queue"],
    isEnabled: () => boolean,
  ): void {
    guardRetryQueue(
      { _retryQueue: queue } as unknown as GuardTarget,
      isEnabled,
    );
  }

  it("drops failed-request retries and stops polling after opt-out", () => {
    const { queue, calls } = fakeQueue();
    guard(queue, () => false);

    queue._enqueue({ url: "/e" });
    queue._flush();

    expect(calls.enqueue).toBe(0);
    expect(calls.flush).toBe(0);
    expect(queue._queue).toEqual([]);
    expect(queue._isPolling).toBe(false);
    expect(queue._poller).toBeUndefined();
  });

  it("passes retries through while analytics is on", () => {
    const { queue, calls } = fakeQueue();
    guard(queue, () => true);

    queue._enqueue({ url: "/e" });
    queue._flush();

    expect(calls.enqueue).toBe(1);
    expect(calls.flush).toBe(1);
  });

  it("empties queued retries before the SDK's unload beacon flush", () => {
    const { queue, calls } = fakeQueue();
    const originalUnload = queue.unload;
    let queuedAtUnload: unknown[] | undefined;
    queue.unload = () => {
      queuedAtUnload = [...queue._queue];
      originalUnload();
    };
    guard(queue, () => false);

    queue.unload();

    expect(queuedAtUnload).toEqual([]);
    expect(calls.unload).toBe(1);
    expect(queue._isPolling).toBe(false);
  });
});
