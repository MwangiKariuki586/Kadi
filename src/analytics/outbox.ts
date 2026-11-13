/**
 * Small, capped localStorage outbox for analytics events.
 *
 * posthog-js retries from memory, but an offline PWA can be closed before the
 * network returns. Queuing the events we care about lets us replay them on the
 * next online boot without changing gameplay.
 */

export const OUTBOX_KEY = "kadi-analytics-outbox";
export const OUTBOX_CAP = 100;

export type OutboxProperties = Record<string, string | number | boolean | null>;

export interface OutboxEvent {
  /**
   * Stable event UUID. Passed to PostHog so a retry after a crash can be
   * deduplicated instead of recorded twice. Legacy entries may omit it.
   */
  id?: string;
  event: string;
  properties: OutboxProperties;
  timestamp: number;
}

export interface OutboxStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let cachedStorage: OutboxStorage | null | undefined;

/** localStorage when it is usable; null in SSR, private mode, or tests. */
export function getOutboxStorage(): OutboxStorage | null {
  if (cachedStorage !== undefined) return cachedStorage;
  try {
    if (typeof localStorage === "undefined") {
      cachedStorage = null;
      return cachedStorage;
    }
    const probe = "__kadi_analytics_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    cachedStorage = localStorage;
  } catch {
    cachedStorage = null;
  }
  return cachedStorage;
}

function isOutboxEvent(raw: unknown): raw is OutboxEvent {
  if (!raw || typeof raw !== "object") return false;
  const candidate = raw as Partial<OutboxEvent>;
  if (typeof candidate.event !== "string" || candidate.event.length === 0) return false;
  if (
    candidate.id !== undefined &&
    (typeof candidate.id !== "string" || candidate.id.length === 0)
  ) {
    return false;
  }
  if (typeof candidate.timestamp !== "number" || !Number.isFinite(candidate.timestamp)) {
    return false;
  }
  if (
    !candidate.properties ||
    typeof candidate.properties !== "object" ||
    Array.isArray(candidate.properties)
  ) {
    return false;
  }
  return true;
}

export function readOutbox(storage: OutboxStorage | null): OutboxEvent[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOutboxEvent).slice(-OUTBOX_CAP);
  } catch {
    return [];
  }
}

function writeOutbox(storage: OutboxStorage, events: OutboxEvent[]): boolean {
  try {
    if (events.length === 0) {
      storage.removeItem(OUTBOX_KEY);
    } else {
      storage.setItem(OUTBOX_KEY, JSON.stringify(events.slice(-OUTBOX_CAP)));
    }
    return true;
  } catch {
    return false;
  }
}

/** UUID v4 for deduplicating retried events. Not an identity. */
function newEventId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/** Add one event, dropping the oldest when the cap is reached. */
export function enqueueOutbox(
  storage: OutboxStorage | null,
  event: OutboxEvent,
): OutboxEvent[] {
  if (!storage) return [];
  const queued = { ...event, id: event.id ?? newEventId() };
  const next = [...readOutbox(storage), queued].slice(-OUTBOX_CAP);
  writeOutbox(storage, next);
  return next;
}

export function clearOutbox(storage: OutboxStorage | null): void {
  if (!storage) return;
  try {
    storage.removeItem(OUTBOX_KEY);
  } catch {
    /* storage can be revoked at runtime; analytics is best-effort */
  }
}

/**
 * Send queued events in order. Stops at the first failure and keeps the rest,
 * so a temporary network error does not lose the queue. Returns the number of
 * events handed to `send`.
 */
export function flushOutbox(
  storage: OutboxStorage | null,
  send: (event: OutboxEvent) => boolean,
): number {
  if (!storage) return 0;
  const events = readOutbox(storage);
  let sent = 0;

  for (let i = 0; i < events.length; i += 1) {
    let ok: boolean;
    try {
      ok = send(events[i]);
    } catch {
      ok = false;
    }
    if (!ok) {
      writeOutbox(storage, events.slice(i));
      return sent;
    }
    sent += 1;
  }

  clearOutbox(storage);
  return sent;
}
