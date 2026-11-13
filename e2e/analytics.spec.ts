import { expect, test } from "@playwright/test";

test("analytics can be opted out and stays off after reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "KADI" })).toBeVisible();

  await page.getByRole("button", { name: "Open settings" }).click();
  const toggle = page.getByTestId("analytics-toggle");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  // savePatch persists in the background; wait for IndexedDB to hold the
  // opt-out so the reload cannot race the write and boot analytics back on.
  await page.waitForFunction(async () => {
    const settings = await new Promise<Record<string, unknown> | undefined>(
      (resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("keyval", "readonly");
          const request = tx.objectStore("keyval").get("kadi-settings");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            resolve(request.result as Record<string, unknown> | undefined);
            db.close();
          };
        };
      },
    );
    return settings?.analytics === false;
  });

  await page.reload();
  await expect(page.getByRole("heading", { name: "KADI" })).toBeVisible();
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByTestId("analytics-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
