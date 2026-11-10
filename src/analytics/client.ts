import type { PostHog, PostHogConfig } from "posthog-js";
import type { AnalyticsEventMap, AnalyticsEventName } from "./events";
import {
  clearOutbox,
  enqueueOutbox,
  flushOutbox,
  getOutboxStorage,
  type OutboxProperties,
} from "./outbox";

export interface AnalyticsEnv {
  VITE_POSTHOG_KEY?: string;
  VITE_POSTHOG_HOST?: string;
  VITE_POSTHOG_DEV?: string;
}

export interface AnalyticsContext {
  dev: boolean;
  doNotTrack?: boolean;
  automation?: boolean;
}

export interface AnalyticsConfig {
  key: string;
  host: string;
}

const DEFAULT_HOST = "https://us.i.posthog.com";

/** Resolve build-time config. Analytics is opt-out, never opt-in by default. */
export function resolveAnalyticsConfig(
  env: AnalyticsEnv,
  context: AnalyticsContext,
): AnalyticsConfig | null {
  if (context.doNotTrack || context.automation) return null;

  const key = env.VITE_POSTHOG_KEY?.trim();
  if (!key) return null;

  // Local dev is silent unless explicitly requested, so `npm run dev` and
  // Playwright never pollute the production project by accident.
  if (context.dev && env.VITE_POSTHOG_DEV !== "true") return null;

  const host = env.VITE_POSTHOG_HOST?.trim().replace(/\/+$/, "") || DEFAULT_HOST;
  return { key, host };
}

/** Privacy-first SDK config: explicit events, masked replay, no person data. */
export function buildPostHogConfig(host: string): Partial<PostHogConfig> {
  return {
    api_host: host,
    defaults: "2026-08-30",

    // No autocapture, pageviews, heatmaps, surveys, or error tracking.
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_performance: false,
    capture_exceptions: false,
    disable_surveys: true,
    rageclick: false,

    // Anonymous, first-party persistence. No IP, no person profiles.
    // Start opted out at the SDK level and opt in explicitly: reset() clears
    // consent back to this default, so opting out can never re-enable capture.
    person_profiles: "never",
    persistence: "localStorage",
    cross_subdomain_cookie: false,
    ip: false,
    respect_dnt: true,
    opt_out_capturing_by_default: true,

    // Session replay. Inputs and anything marked data-ph-mask are masked.
    disable_session_recording: false,
    enable_recording_console_log: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
      recordBody: false,
      recordHeaders: false,
      streamNetworkBody: false,
    },
  };
}

function doNotTrackEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    doNotTrack?: string | null;
    msDoNotTrack?: string | null;
  };
  return (
    nav.doNotTrack === "1" ||
    nav.doNotTrack === "yes" ||
    nav.msDoNotTrack === "1"
  );
}

function isAutomatedBrowser(): boolean {
  return typeof navigator !== "undefined" && navigator.webdriver === true;
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function baseProperties(): OutboxProperties {
  return {
    deployment_host:
      typeof location !== "undefined" && location.host ? location.host : "unknown",
  };
}

let client: PostHog | null = null;
let initPromise: Promise<PostHog | null> | null = null;
let config: AnalyticsConfig | null = null;
let configured = false;
let enabled = false;
let onlineBound = false;

function configure(): AnalyticsConfig | null {
  if (configured) return config;
  configured = true;
  config = resolveAnalyticsConfig(import.meta.env, {
    dev: import.meta.env.DEV,
    doNotTrack: doNotTrackEnabled(),
    automation: isAutomatedBrowser(),
  });
  return config;
}

function flush(): void {
  if (!client) return;
  flushOutbox(getOutboxStorage(), (event) => {
    const captured = client!.capture(event.event, event.properties, {
      timestamp: new Date(event.timestamp),
    });
    return captured !== undefined;
  });
}

async function ensureClient(): Promise<PostHog | null> {
  if (client) return client;
  if (!config) return null;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const { default: posthog } = await import("posthog-js");
      if (!enabled || !config) return null;

      posthog.init(config.key, buildPostHogConfig(config.host));
      posthog.opt_in_capturing({ captureEventName: false });
      client = posthog;
      flush();
      return posthog;
    } catch {
      // Blocked CDN, offline first load, privacy extension: analytics is
      // optional, so the game keeps running without it.
      return null;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

function handleOnline(): void {
  if (!enabled) return;
  if (!client) {
    void ensureClient().then((posthog) => {
      if (!posthog || !enabled) return;
      posthog.opt_in_capturing({ captureEventName: false });
      posthog.startSessionRecording();
      flush();
    });
    return;
  }
  flush();
}

function bindOnline(): void {
  if (onlineBound || typeof window === "undefined") return;
  onlineBound = true;
  window.addEventListener("online", handleOnline);
}

/** Start (or stay silent) once settings have loaded. Never blocks the UI. */
export function initAnalytics(on: boolean): void {
  if (!on) {
    enabled = false;
    clearOutbox(getOutboxStorage());
    return;
  }

  const cfg = configure();
  if (!cfg) {
    enabled = false;
    return;
  }

  enabled = true;
  bindOnline();
  void ensureClient();
}

/** Settings toggle. Off stops replay, opts out, resets the ID, clears the queue. */
export function setAnalyticsEnabled(on: boolean): void {
  if (!on) {
    enabled = false;
    clearOutbox(getOutboxStorage());
    if (client) {
      try {
        client.stopSessionRecording();
        client.opt_out_capturing();
        client.reset();
      } catch {
        /* best-effort privacy cleanup */
      }
    }
    return;
  }

  const cfg = configure();
  if (!cfg) {
    enabled = false;
    return;
  }

  enabled = true;
  bindOnline();
  void ensureClient().then((posthog) => {
    if (!posthog || !enabled) return;
    posthog.opt_in_capturing({ captureEventName: false });
    posthog.startSessionRecording();
    flush();
  });
}

/** Capture one explicit event. Queues while offline or before the SDK loads. */
export function track<K extends AnalyticsEventName>(
  event: K,
  properties: AnalyticsEventMap[K],
): void {
  if (!enabled) return;

  const payload: OutboxProperties = { ...baseProperties(), ...properties };

  if (!client || !isOnline()) {
    enqueueOutbox(getOutboxStorage(), {
      event,
      properties: payload,
      timestamp: Date.now(),
    });
    return;
  }

  client.capture(event, payload);
}
