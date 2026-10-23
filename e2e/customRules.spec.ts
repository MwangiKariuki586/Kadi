import { expect, test, type Page } from "@playwright/test";

async function gotoHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "KADI" })).toBeVisible();
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

async function openLobby(page: Page) {
  await page.getByRole("button", { name: "Play Now" }).click();
  await expect(page.getByRole("heading", { name: "New Game" })).toBeVisible();
}

test("renaming a custom table replaces the old profile and clearing restores Standard", async ({
  page,
}) => {
  await gotoHome(page);
  await openSettings(page);
  await page.getByRole("button", { name: /Custom rules/ }).click();
  await expect(
    page.getByRole("heading", { name: "Custom rules" }),
  ).toBeVisible();
  await page.getByLabel("Rules name").fill("Estate Test");
  await page.getByRole("button", { name: /Save table rules/ }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await openLobby(page);
  await expect(
    page.getByRole("button", { name: "Customize Estate Test" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Customize Estate Test" }).click();
  await expect(
    page.getByRole("heading", { name: "Custom rules" }),
  ).toBeVisible();
  await expect(page.getByLabel("Rules name")).toHaveValue("Estate Test");
  await page.getByLabel("Rules name").fill("Estate Renamed");
  await page.getByRole("button", { name: /Save table rules/ }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await openLobby(page);
  await expect(
    page.getByRole("button", { name: "Customize Estate Renamed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Customize Estate Test" }),
  ).toHaveCount(0);

  await openSettings(page);
  await page.getByRole("button", { name: /Clear all custom rules/ }).click();
  await page.getByRole("button", { name: /Press again to delete/ }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await openLobby(page);
  await expect(
    page.getByRole("button", { name: /Customize Estate Renamed/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Standard Maua/ }),
  ).toHaveAttribute("aria-pressed", "true");
});
