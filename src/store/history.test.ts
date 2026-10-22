import { describe, expect, it } from "vitest";
import {
  HISTORY_CAP,
  appendMatch,
  createMatchId,
  leaderboard,
  normalizeHistory,
  relativeTime,
  type MatchRecord,
} from "./history";

function match(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: "m1",
    at: Date.parse("2026-10-20T10:00:00Z"),
    playerNames: ["You", "Jabari", "Amani"],
    winnerIndex: 0,
    difficulty: "medium",
    presetName: "Standard Maua",
    turns: 12,
    ...overrides,
  };
}

describe("normalizeHistory", () => {
  it("drops malformed entries and sorts newest first", () => {
    const older = match({ id: "old", at: 1000 });
    const newer = match({ id: "new", at: 5000 });
    const bad = [
      null,
      {},
      { ...match(), id: "" },
      { ...match(), playerNames: [] },
      { ...match(), winnerIndex: 9 },
      { ...match(), difficulty: "impossible" },
      { ...match(), turns: Number.NaN },
    ];
    expect(normalizeHistory([older, ...bad, newer]).map((r) => r.id)).toEqual([
      "new",
      "old",
    ]);
    expect(normalizeHistory("nope")).toEqual([]);
  });

  it("caps the history", () => {
    const records = Array.from({ length: HISTORY_CAP + 5 }, (_, i) =>
      match({ id: `m${i}`, at: i }),
    );
    expect(normalizeHistory(records)).toHaveLength(HISTORY_CAP);
  });
});

describe("appendMatch", () => {
  it("prepends, dedupes by id and respects the cap", () => {
    const first = match({ id: "a", at: 1 });
    const second = match({ id: "b", at: 2 });
    expect(appendMatch([first], second).map((r) => r.id)).toEqual(["b", "a"]);
    const updated = appendMatch([first], { ...first, turns: 99 });
    expect(updated).toHaveLength(1);
    expect(updated[0].turns).toBe(99);
    expect(appendMatch([], first, 0)).toEqual([]);
  });
});

describe("leaderboard", () => {
  it("counts wins and games per player, including zero-win bots", () => {
    const records = [
      match({ id: "1", playerNames: ["You", "Jabari"], winnerIndex: 0 }),
      match({ id: "2", playerNames: ["You", "Jabari"], winnerIndex: 1 }),
      match({ id: "3", playerNames: ["You", "Amani"], winnerIndex: 1 }),
    ];
    const rows = leaderboard(records, ["You", "Jabari", "Amani", "Zawadi"]);
    expect(rows.find((r) => r.name === "You")).toEqual({
      name: "You",
      wins: 1,
      games: 3,
    });
    expect(rows.find((r) => r.name === "Jabari")).toEqual({
      name: "Jabari",
      wins: 1,
      games: 2,
    });
    expect(rows.find((r) => r.name === "Amani")).toEqual({
      name: "Amani",
      wins: 1,
      games: 1,
    });
    expect(rows.find((r) => r.name === "Zawadi")).toEqual({
      name: "Zawadi",
      wins: 0,
      games: 0,
    });
    expect(rows[0].name).toBe("You");
  });

  it("breaks ties by games, then name", () => {
    const rows = leaderboard(
      [
        match({ id: "1", playerNames: ["You", "Neema"], winnerIndex: 0 }),
        match({ id: "2", playerNames: ["You", "Amani"], winnerIndex: 1 }),
      ],
      ["You", "Neema", "Amani"],
    );
    expect(rows.map((r) => r.name)).toEqual(["You", "Amani", "Neema"]);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  it("formats friendly windows", () => {
    expect(relativeTime(now - 20_000, now)).toBe("just now");
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(relativeTime(now - 2 * 3_600_000, now)).toBe("2 hours ago");
    expect(relativeTime(now - 36 * 3_600_000, now)).toBe("1 day ago");
    expect(relativeTime(now - 3 * 86_400_000, now)).toBe("3 days ago");
  });
});

describe("createMatchId", () => {
  it("returns a unique non-empty id", () => {
    const a = createMatchId(1);
    const b = createMatchId(2);
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
