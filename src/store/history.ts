import type { Difficulty } from "../bots/bot";

export const HISTORY_CAP = 50;

export interface MatchRecord {
  id: string;
  at: number;
  playerNames: string[];
  winnerIndex: number;
  difficulty: Difficulty;
  presetName: string;
  turns: number;
}

export interface LeaderRow {
  name: string;
  wins: number;
  games: number;
}

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

function isRecord(raw: unknown): raw is MatchRecord {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Partial<MatchRecord>;
  if (typeof r.id !== "string" || r.id.length === 0) return false;
  if (typeof r.at !== "number" || !Number.isFinite(r.at)) return false;
  if (!Array.isArray(r.playerNames)) return false;
  if (r.playerNames.length < 2 || r.playerNames.length > 5) return false;
  if (!r.playerNames.every((n) => typeof n === "string" && n.length > 0)) return false;
  if (
    typeof r.winnerIndex !== "number" ||
    !Number.isInteger(r.winnerIndex) ||
    r.winnerIndex < 0 ||
    r.winnerIndex >= r.playerNames.length
  ) {
    return false;
  }
  if (!DIFFICULTIES.includes(r.difficulty as Difficulty)) return false;
  if (typeof r.presetName !== "string") return false;
  if (typeof r.turns !== "number" || !Number.isFinite(r.turns)) return false;
  return true;
}

/** Defensive loader: drops malformed entries, newest first, capped. */
export function normalizeHistory(raw: unknown): MatchRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .sort((a, b) => b.at - a.at)
    .slice(0, HISTORY_CAP);
}

export function appendMatch(
  history: MatchRecord[],
  record: MatchRecord,
  cap = HISTORY_CAP,
): MatchRecord[] {
  return [record, ...history.filter((r) => r.id !== record.id)]
    .sort((a, b) => b.at - a.at)
    .slice(0, cap);
}

/**
 * Local ladder: every table win counts once for its winner. Bots are included
 * even with zero wins so the board is never a single row.
 */
export function leaderboard(history: MatchRecord[], names: string[]): LeaderRow[] {
  const rows = new Map<string, LeaderRow>();
  for (const name of names) {
    if (!rows.has(name)) rows.set(name, { name, wins: 0, games: 0 });
  }
  for (const match of history) {
    for (const name of match.playerNames) {
      const row = rows.get(name) ?? { name, wins: 0, games: 0 };
      row.games += 1;
      rows.set(name, row);
    }
    const winner = match.playerNames[match.winnerIndex];
    if (winner) {
      const row = rows.get(winner) ?? { name: winner, wins: 0, games: 0 };
      row.wins += 1;
      rows.set(winner, row);
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.wins - a.wins ||
      b.games - a.games ||
      a.name.localeCompare(b.name),
  );
}

export function relativeTime(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;
  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function createMatchId(now = Date.now()): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `m-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
