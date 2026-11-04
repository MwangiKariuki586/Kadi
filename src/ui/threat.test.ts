import { describe, expect, it } from "vitest";
import type { Card } from "../engine/cards";
import { STANDARD_MAUA } from "../engine/rules";
import { createGame, type GameState } from "../engine/state";
import { declareKadi } from "../engine/validator";
import { seatThreat } from "./threat";

const C = (
  rank: Card["rank"],
  suit: Card["suit"] = "hearts",
  id?: string,
): Card => ({
  id: id ?? `${rank}-${suit}`,
  suit,
  rank,
});

function table(hand: Card[], top: Card, config = STANDARD_MAUA): GameState {
  const s = createGame({ numPlayers: 2, config, random: () => 0.999 });
  s.hands[0] = [C("7", "clubs", "human")];
  s.hands[1] = hand;
  s.discardPile = [top];
  s.currentPlayer = 1;
  s.pendingPenalty = 0;
  s.pendingSkip = 0;
  s.pendingReverse = 0;
  s.activeSuit = null;
  s.activeCardRequest = null;
  s.drawPile = Array.from({ length: 20 }, (_, i) =>
    C("7", "clubs", `d${i}`),
  );
  return s;
}

describe("seatThreat", () => {
  it("flags an undeclared seat that can dump its whole hand now", () => {
    const s = table([C("9", "hearts", "closer")], C("8", "hearts"));
    expect(seatThreat(s, 1)).toBe("finish");
  });

  it("upgrades to kadi once the seat declares", () => {
    const s = table([C("9", "hearts", "closer")], C("8", "hearts"));
    expect(declareKadi(s, 1)).toBe(true);
    expect(seatThreat(s, 1)).toBe("kadi");
  });

  it("keeps the kadi badge after the seat can no longer dump", () => {
    const s = table([C("9", "hearts", "closer")], C("8", "hearts"));
    expect(declareKadi(s, 1)).toBe(true);
    s.discardPile = [C("K", "clubs")];
    expect(seatThreat(s, 1)).toBe("kadi");
  });

  it("keeps the kadi badge through the winning dump", () => {
    const s = table([C("9", "hearts", "closer")], C("8", "hearts"));
    expect(declareKadi(s, 1)).toBe(true);
    s.hands[1] = [];
    s.gameOver = true;
    s.winnerIndex = 1;
    expect(seatThreat(s, 1)).toBe("kadi");
  });

  it("stays null when the hand cannot close", () => {
    const s = table([C("A", "hearts", "ace")], C("K", "hearts"));
    expect(seatThreat(s, 1)).toBe(null);
  });

  it("stays null while a penalty is owed", () => {
    const s = table([C("9", "hearts", "closer")], C("8", "hearts"));
    s.pendingPenalty = 2;
    expect(seatThreat(s, 1)).toBe(null);
  });

  it("reads finish on silent-finish tables", () => {
    const s = table([C("9", "hearts", "closer")], C("8", "hearts"), {
      ...STANDARD_MAUA,
      mustSayNikoKadi: false,
    });
    expect(declareKadi(s, 1)).toBe(false);
    expect(seatThreat(s, 1)).toBe("finish");
  });
});
