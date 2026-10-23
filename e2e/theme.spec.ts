import { expect, test, type Page } from "@playwright/test";

async function gotoHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "KADI" })).toBeVisible();
}

test("challenge friends modal is honest and routes back to solo play", async ({
  page,
}) => {
  await gotoHome(page);
  await page.getByRole("button", { name: /Create Room/ }).click();
  const dialog = page.getByRole("dialog", { name: /Private rooms are coming/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Online rooms and friend invites/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await dialog.getByRole("button", { name: /Test yourself/ }).click();
  await expect(page.getByRole("heading", { name: "New Game" })).toBeVisible();
});

test("challenge modal closes on Escape and restores the opener", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("desktop"),
    "desktop keyboard focus",
  );
  await gotoHome(page);
  const opener = page.getByRole("button", { name: /Create Room/ }).first();
  await opener.click();
  const dialog = page.getByRole("dialog", { name: /Private rooms are coming/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("recent games opens My Games from the home card", async ({ page }) => {
  await gotoHome(page);
  await page.getByRole("button", { name: "View all" }).click();
  await expect(page.getByRole("heading", { name: "My Games" })).toBeVisible();
  await expect(page.getByText("No finished games yet")).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "KADI" })).toBeVisible();
  await expect(page.getByText("Leaderboard")).toHaveCount(0);
});

test("home mode cards are desktop-only", async ({ page }) => {
  await gotoHome(page);
  const modes = page.getByText("Choose a game mode");
  const size = page.viewportSize();
  if (size && size.width >= 1024) {
    await expect(modes).toBeVisible();
  } else {
    await expect(modes).toBeHidden();
  }
});

test("home mode cards preselect the table size in the lobby", async ({
  page,
}) => {
  const size = page.viewportSize();
  test.skip(
    !size || size.width < 1024,
    "home mode cards are hidden below lg",
  );
  await gotoHome(page);
  const fourPlayer = page.getByRole("button", { name: /4P/ });
  await fourPlayer.click();
  await expect(page.getByRole("heading", { name: "New Game" })).toBeVisible();
  await expect(page.getByRole("button", { name: /4P/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
