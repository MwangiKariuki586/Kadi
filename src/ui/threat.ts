import type { GameState } from "../engine/state";
import { canDumpWinningNow } from "../engine/validator";

export type SeatThreat = "kadi" | "finish" | null;

/**
 * Per-seat KADI threat for the table UI.
 *
 * "kadi"   — the seat has called KADI. This is deliberately independent of
 *            finishability: the call is public and must stay on the card after
 *            the toast, after the seat's turn, and through the winning dump.
 *            kadiCalls clears when that seat picks cards or empties its hand
 *            without winning.
 * "finish" — the seat can dump its whole hand now but has not called, so it
 *            is one turn from calling KADI and finishing.
 *
 * Uses canDumpWinningNow (call-agnostic) instead of canFinishNow: a caller
 * that has not survived every opponent yet reads "kadi", and a not-yet-caller
 * that can go out reads "finish" even before the call. On silent-finish tables
 * kadiCalls stays false, so the seat reads "finish".
 */
export function seatThreat(state: GameState, seat: number): SeatThreat {
  const called =
    state.config.mustSayNikoKadi !== false && state.kadiCalls[seat] === true;
  if (called) return "kadi";
  if (!canDumpWinningNow(state, seat)) return null;
  return "finish";
}
