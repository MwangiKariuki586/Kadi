import { describe, expect, it } from "vitest";
import {
  clearOutbox,
  enqueueOutbox,
  flushOutbox,
  OUTBOX_CAP,
  OUTBOX_KEY,
  readOutbox,
  type OutboxEvent,
  type OutboxStorage,
} from "./outbox";

function memoryStorage(): OutboxStorage & { dump: Map<string, string> } {
  const dump = new Map<string, string>();
  return {
    dump,
    getItem: (key) => dump.get(key) ?? null,
    setItem: (key, value) => {
      dump.set(key, value);
    },
    removeItem: (key) => {
      dump.delete(key);
    },
  };
}

function event(index: number): OutboxEvent {
  return {
    event: "screen_viewed",
    properties: { screen: "home", index },
    timestamp: 1_000 + index,
  };
}

describe("analytics outbox", () => {
  it("keeps events in order", () => {
    const storage = memoryStorage();
    enqueueOutbox(storage, event(1));
    enqueueOutbox(storage, event(2));
    expect(readOutbox(storage).map((e) => e.properties.index)).toEqual([1, 2]);
  });

  it("caps the queue and drops the oldest events", () => {
    const storage = memoryStorage();
    for (let i = 0; i < OUTBOX_CAP + 5; i += 1) {
      enqueueOutbox(storage, event(i));
    }
    const queued = readOutbox(storage);
    expect(queued).toHaveLength(OUTBOX_CAP);
    expect(queued[0].properties.index).toBe(5);
    expect(queued[queued.length - 1].properties.index).toBe(OUTBOX_CAP + 4);
  });

  it("ignores corrupt or unexpected data", () => {
    const storage = memoryStorage();
    storage.setItem(OUTBOX_KEY, "{not json");
    expect(readOutbox(storage)).toEqual([]);

    storage.setItem(
      OUTBOX_KEY,
      JSON.stringify([{ event: "ok", properties: {}, timestamp: 1 }, { nope: true }]),
    );
    expect(readOutbox(storage)).toHaveLength(1);
  });

  it("does not throw when storage is blocked", () => {
    const blocked: OutboxStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect(readOutbox(blocked)).toEqual([]);
    expect(() => enqueueOutbox(blocked, event(1))).not.toThrow();
    expect(() => clearOutbox(blocked)).not.toThrow();
    expect(() => flushOutbox(blocked, () => true)).not.toThrow();
  });

  it("flushes in order and clears on success", () => {
    const storage = memoryStorage();
    enqueueOutbox(storage, event(1));
    enqueueOutbox(storage, event(2));
    const sent: number[] = [];

    const count = flushOutbox(storage, (queued) => {
      sent.push(queued.properties.index as number);
      return true;
    });

    expect(count).toBe(2);
    expect(sent).toEqual([1, 2]);
    expect(readOutbox(storage)).toEqual([]);
  });

  it("keeps the failed event and everything after it", () => {
    const storage = memoryStorage();
    enqueueOutbox(storage, event(1));
    enqueueOutbox(storage, event(2));
    enqueueOutbox(storage, event(3));

    const count = flushOutbox(storage, (queued) => queued.properties.index !== 2);

    expect(count).toBe(1);
    expect(readOutbox(storage).map((e) => e.properties.index)).toEqual([2, 3]);
  });

  it("clears everything on opt-out", () => {
    const storage = memoryStorage();
    enqueueOutbox(storage, event(1));
    clearOutbox(storage);
    expect(readOutbox(storage)).toEqual([]);
  });
});
