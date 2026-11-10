import { expect, test } from "@playwright/test";

test("analytics can be opted out and stays off after reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "KADI" })).toBeVisible();

  await page.getByRole("button", { name: "Open settings" }).click();
  const toggle = page.getByTestId("analytics-toggle");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await page.reload();
  await expect(page.getByRole("heading", { name: "KADI" })).toBeVisible();
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByTestId("analytics-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
