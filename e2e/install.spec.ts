import { expect, test } from "@playwright/test";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const WHATSAPP_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.6 A";
const DESKTOP_FIREFOX =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0";

test("home offers install guidance", async ({ page }) => {
  await page.goto("/");

  const button = page.getByTestId("install-button");
  await expect(button).toBeVisible();
  await button.click();

  const help = page.getByTestId("install-help");
  await expect(help).toBeVisible();
  await expect(help).toContainText("Install app");

  await page.getByRole("button", { name: "Got it" }).click();
  await expect(help).toBeHidden();
});

test("uses the browser install prompt when it is available", async ({
  page,
}) => {
  await page.goto("/");

  await page.evaluate(() => {
    const w = window as Window & { __installPromptCalled?: boolean };
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
    };
    event.prompt = async () => {
      w.__installPromptCalled = true;
    };
    event.userChoice = Promise.resolve({
      outcome: "accepted",
      platform: "web",
    });
    window.dispatchEvent(event);
  });

  await page.getByTestId("install-button").click();
  await page.waitForFunction(() =>
    Boolean(
      (window as Window & { __installPromptCalled?: boolean })
        .__installPromptCalled,
    ),
  );
  await expect(page.getByTestId("install-button")).toHaveCount(0);
});

test("post-match card can be dismissed for good", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("install-button")).toBeVisible();

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("keyval-store");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put(
        { games: 1, wins: 1, bestStreak: 1, streak: 1 },
        "kadi-stats",
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  await page.reload();

  const desktop = (page.viewportSize()?.width ?? 0) >= 1024;
  const card = page.getByTestId(
    desktop ? "install-card-desktop" : "install-card-mobile",
  );
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Not now" }).click();
  await expect(card).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("install-button")).toBeVisible();
  await expect(page.getByTestId(/^install-card-/)).toHaveCount(0);
});

test.describe("iOS install guidance", () => {
  test.use({ userAgent: IPHONE_SAFARI });

  test("shows Add to Home Screen steps", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("install-button").click();

    const help = page.getByTestId("install-help");
    await expect(help).toBeVisible();
    await expect(help).toContainText("Add Kadi to Home Screen");
    await expect(help).toContainText("Tap Share");
  });
});

test.describe("in-app browser install guidance", () => {
  test.use({ userAgent: WHATSAPP_ANDROID });

  test("points users to Chrome or Safari", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("install-button").click();

    const help = page.getByTestId("install-help");
    await expect(help).toBeVisible();
    await expect(help).toContainText("Open Kadi in your browser");
    await expect(help).toContainText("Choose Open in browser");
  });
});

test.describe("unsupported browser install guidance", () => {
  test.use({ userAgent: DESKTOP_FIREFOX });

  test("sends users to Chrome or Edge", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("install-button").click();

    const help = page.getByTestId("install-help");
    await expect(help).toBeVisible();
    await expect(help).toContainText("Use Chrome or Edge");
  });
});
