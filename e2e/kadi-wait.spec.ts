import { expect, test, type Page } from "@playwright/test";
import type { Card } from "../src/engine/cards";
import { STANDARD_MAUA } from "../src/engine/rules";
import { createGame } from "../src/engine/state";
import type { ActiveGameSave } from "../src/store/local";

const C = (rank: Card["rank"], suit: Card["suit"], id: string): Card => ({
  id,
  rank,
  suit,
});

function waitingSave(): ActiveGameSave {
  const state = createGame({
    numPlayers: 2,
    config: STANDARD_MAUA,
    random: () => 0.999,
  });
  state.hands = [
    [C("5", "hearts", "e2e-5h"), C("5", "diamonds", "e2e-5d")],
    [C("4", "clubs", "e2e-4c")],
  ];
  state.discardPile = [C("9", "hearts", "e2e-9h")];
  state.drawPile = Array.from({ length: 12 }, (_, i) =>
    C("7", "diamonds", `e2e-d${i}`),
  );
  state.currentPlayer = 0;
  state.direction = 1;
  state.pendingPenalty = 0;
  state.pendingPenaltyRank = null;
  state.pendingPenaltySuit = null;
  state.activeSuit = null;
  state.lastSuitBeforeRequest = null;
  state.activeCardRequest = null;
  state.pendingSkip = 0;
  state.pendingReverse = 0;
  state.kadiCalls = [false, false];
  state.kadiCallTurn = [-1, -1];
  state.kadiSeen = [0, 0];
  state.kadiFalseCalls = [false, false];
  state.turnNumber = 0;
  state.gameOver = false;
  state.winnerIndex = null;
  state.lastEffect = null;
  return {
    state,
    meta: {
      numBots: 1,
      difficulty: "easy",
      presetName: STANDARD_MAUA.name,
      superAce: false,
      savedAt: Date.now(),
    },
  };
}

/** Put a save straight into idb-keyval's store, then reload into the table. */
async function seedSave(page: Page, save: ActiveGameSave) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "KADI" })).toBeVisible();
  await page.evaluate(
    (payload) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("keyval-store", 1);
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains("keyval")) {
            open.result.createObjectStore("keyval");
          }
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("keyval", "readwrite");
          tx.objectStore("keyval").put(payload, "kadi-active-game");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    save,
  );
  await page.reload();
  await expect(page.getByTestId("game-table")).toBeVisible();
}

test("KADI must survive every opponent before the winning dump", async ({
  page,
}) => {
  await seedSave(page, waitingSave());

  const buzzer = page.getByTestId("kadi-buzzer");
  await expect(buzzer).toHaveAttribute("data-kadi-state", "urgent");
  await buzzer.click();
  await expect(buzzer).toHaveAttribute("data-kadi-state", "called");
  await expect(page.getByTestId("feed-panel")).toContainText(
    /Survive all opponents/,
  );
  // The human's own call is status-only, never the large opponent banner.
  await expect(page.getByTestId("kadi-alert")).toHaveCount(0);

  const hand = page.getByTestId("hand");
  await hand.getByRole("button", { name: "5♥" }).click();
  await hand.getByRole("button", { name: "5♦" }).click();
  await expect(
    page.getByText(/all opponents must play before this dump can win/i),
  ).toBeVisible();
  await expect(page.getByTestId("play-button")).toBeDisabled();
  await expect(page.getByTestId("game-over")).toHaveCount(0);
  await expect(hand.getByRole("button")).toHaveCount(2);

  // Play a non-emptying setup instead, then let the bot take its turn.
  await hand.getByRole("button", { name: "5♦" }).click();
  await page.getByTestId("play-button").click();
  await expect(hand.getByRole("button")).toHaveCount(1);
  await expect(page.getByTestId("pick-button")).toBeEnabled({
    timeout: 15_000,
  });

  // The call has survived the bot's turn, so the last card can win.
  await hand.getByRole("button", { name: "5♦" }).click();
  await page.getByTestId("play-button").click();
  await expect(page.getByTestId("game-over")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "You win 🎉" }),
  ).toBeVisible();
});
