import { expect, test, type Page } from "@playwright/test";

async function startGame(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "KADI" })).toBeVisible();
  await page.getByRole("button", { name: "Play Now" }).click();
  await expect(page.getByRole("heading", { name: "New Game" })).toBeVisible();
  await page.getByRole("button", { name: /2P/ }).click();
  await page.getByRole("button", { name: /Deal me in/ }).click();
  await expect(page.getByTestId("game-table")).toBeVisible();
  await expect(page.getByTestId("hand")).toBeVisible();
}

async function waitForMyTurn(page: Page) {
  const pick = page.getByTestId("pick-button");
  await expect(pick).toBeEnabled({ timeout: 15_000 });
  return pick;
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("desktop"),
    "desktop keyboard shortcuts",
  );
  await startGame(page);
});

test("shortcut hints are exposed and the help dialog toggles with ?", async ({
  page,
}) => {
  await expect(page.getByTestId("play-button")).toHaveAttribute(
    "aria-keyshortcuts",
    "P",
  );
  await expect(page.getByTestId("pick-button")).toHaveAttribute(
    "aria-keyshortcuts",
    "D",
  );
  await expect(page.getByTestId("kadi-buzzer")).toHaveAttribute(
    "aria-keyshortcuts",
    "K",
  );

  const button = page.getByTestId("shortcuts-button");
  await expect(button).toBeVisible();
  await button.click();

  const dialog = page.getByTestId("shortcuts-dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Keyboard shortcuts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close keyboard shortcuts" }),
  ).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();

  await page.keyboard.press("Shift+/");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Shift+/");
  await expect(dialog).toBeHidden();
});

test("K declares KADI", async ({ page }) => {
  await page.keyboard.press("k");
  await expect(page.getByTestId("feed-panel")).toContainText(/KADI/);
});

test("D picks or accepts the pending consequence on your turn", async ({
  page,
}) => {
  await waitForMyTurn(page);
  await page.keyboard.press("d");
  await expect(page.getByTestId("feed-panel")).toContainText(
    /You (pick|eat|sit)/,
  );
});

test("P plays a hinted legal card", async ({ page }) => {
  await waitForMyTurn(page);
  const legal = page
    .locator('[data-testid="hand"] button[data-hint="true"]')
    .first();
  test.skip((await legal.count()) === 0, "no legal single in this deal");

  await legal.click();
  const play = page.getByTestId("play-button");
  await expect(play).toBeEnabled();
  await page.keyboard.press("p");

  const suitDialog = page.getByRole("dialog", { name: "Choose a suit" });
  const suitPrompted = await suitDialog
    .waitFor({ state: "visible", timeout: 250 })
    .then(() => true)
    .catch(() => false);
  if (suitPrompted) {
    await page.keyboard.press("Escape");
    return;
  }

  await expect(page.getByTestId("feed-panel")).toContainText(/You play/);
});

test("Escape clears a card selection", async ({ page }) => {
  await waitForMyTurn(page);
  const card = page.getByTestId("hand").locator("button").first();
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("Escape");
  await expect(card).toHaveAttribute("aria-pressed", "false");
});
