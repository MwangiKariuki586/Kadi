import { expect, test, type Page } from "@playwright/test";

async function gotoHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "KADI" })).toBeVisible();
}

async function openLobby(page: Page) {
  await gotoHome(page);
  await page.getByRole("button", { name: /Play/ }).click();
  await expect(page.getByRole("heading", { name: "New Game" })).toBeVisible();
}

async function startFourPlayerGame(page: Page) {
  await openLobby(page);
  await page.getByRole("button", { name: /4P/ }).click();
  await page.getByRole("button", { name: /Deal me in/ }).click();
  await expect(page.getByTestId("game-table")).toBeVisible();
  await expect(page.getByTestId("hand")).toBeVisible();
}

function viewport(page: Page) {
  const size = page.viewportSize();
  if (!size) throw new Error("viewport size unavailable");
  return size;
}

test("home keeps the CTA beside the hero at lg and below it on smaller screens", async ({
  page,
}) => {
  await gotoHome(page);
  const hero = await page.getByRole("heading", { name: "KADI" }).boundingBox();
  const play = await page.getByRole("button", { name: /Play/ }).boundingBox();
  expect(hero).not.toBeNull();
  expect(play).not.toBeNull();

  if (viewport(page).width >= 1024) {
    expect(play!.x).toBeGreaterThan(hero!.x + hero!.width);
  } else {
    expect(play!.y).toBeGreaterThan(hero!.y + hero!.height);
  }
});

test("lobby switches to two columns at lg", async ({ page }) => {
  await openLobby(page);
  const players = await page.getByText("Players", { exact: true }).boundingBox();
  const rules = await page.getByText("Game rules", { exact: true }).boundingBox();
  expect(players).not.toBeNull();
  expect(rules).not.toBeNull();

  if (viewport(page).width >= 1024) {
    expect(Math.abs(players!.y - rules!.y)).toBeLessThan(24);
    expect(rules!.x).toBeGreaterThan(players!.x);
  } else {
    expect(rules!.y).toBeGreaterThan(players!.y + 24);
  }
});

test("settings and rules builder use two columns from md", async ({ page }) => {
  await gotoHome(page);
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings ⚙️" })).toBeVisible();

  const sound = await page.getByText("Sound & help", { exact: true }).boundingBox();
  const rules = await page.getByText("Game rules", { exact: true }).boundingBox();
  expect(sound).not.toBeNull();
  expect(rules).not.toBeNull();

  if (viewport(page).width >= 768) {
    expect(Math.abs(sound!.y - rules!.y)).toBeLessThan(24);
    expect(rules!.x).toBeGreaterThan(sound!.x);
  } else {
    expect(rules!.y).toBeGreaterThan(sound!.y + 24);
  }

  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: /Play/ }).click();
  await page.getByRole("button", { name: /Custom rules/ }).click();
  await expect(
    page.getByRole("heading", { name: "Custom rules 🃏" }),
  ).toBeVisible();

  const name = await page.getByText("Name your rules", { exact: true }).boundingBox();
  const desc = await page
    .getByText("Short description", { exact: true })
    .boundingBox();
  expect(name).not.toBeNull();
  expect(desc).not.toBeNull();

  if (viewport(page).width >= 768) {
    expect(Math.abs(name!.y - desc!.y)).toBeLessThan(24);
    expect(desc!.x).toBeGreaterThan(name!.x);
  } else {
    expect(desc!.y).toBeGreaterThan(name!.y + 24);
  }
  await expect(
    page.getByRole("button", { name: /Save table rules/ }),
  ).toBeVisible();
});

test("how-to sidebar sits beside lessons at lg", async ({ page }) => {
  await gotoHome(page);
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(
    page.getByRole("heading", { name: "How to play" }),
  ).toBeVisible();

  const chip = await page.getByRole("button", { name: "🎯 Goal" }).boundingBox();
  const lesson = await page.locator("#howto-goal").boundingBox();
  expect(chip).not.toBeNull();
  expect(lesson).not.toBeNull();

  if (viewport(page).width >= 1024) {
    expect(chip!.x + chip!.width).toBeLessThanOrEqual(lesson!.x);
  } else {
    expect(chip!.y).toBeLessThan(lesson!.y);
  }
});

test("game table builds a seat ring, bottom rail, and feed rail", async ({
  page,
}) => {
  await startFourPlayerGame(page);

  const table = page.getByTestId("game-table");
  const hand = page.getByTestId("hand");
  const draw = page.getByTestId("draw-pile");
  const play = page.getByTestId("play-button");
  const pick = page.getByTestId("pick-button");
  await expect(table).toBeVisible();
  await expect(hand).toBeVisible();
  await expect(draw).toBeVisible();
  await expect(play).toBeVisible();
  await expect(pick).toBeVisible();

  const left = await page.getByTestId("seat-left").boundingBox();
  const top = await page.getByTestId("seat-top").boundingBox();
  const right = await page.getByTestId("seat-right").boundingBox();
  expect(left).not.toBeNull();
  expect(top).not.toBeNull();
  expect(right).not.toBeNull();

  const { width, height } = viewport(page);
  if (width >= 1024) {
    expect(left!.x).toBeLessThan(top!.x);
    expect(top!.x).toBeLessThan(right!.x);
    expect(top!.y).toBeLessThan(left!.y);
    expect(top!.y).toBeLessThan(right!.y);

    const handBox = await hand.boundingBox();
    const playBox = await play.boundingBox();
    expect(handBox).not.toBeNull();
    expect(playBox).not.toBeNull();
    expect(handBox!.y + handBox!.height).toBeLessThanOrEqual(height + 1);
    expect(playBox!.y + playBox!.height).toBeLessThanOrEqual(height + 1);
    expect(handBox!.x).toBeGreaterThanOrEqual(0);
    expect(handBox!.x + handBox!.width).toBeLessThanOrEqual(width + 1);
  }

  if (width >= 1280) {
    await expect(page.getByTestId("feed-rail")).toBeVisible();
    await expect(page.getByTestId("feed-panel")).toBeVisible();
    await expect(page.getByTestId("feed-banner")).toBeHidden();
  } else {
    await expect(page.getByTestId("feed-rail")).toBeHidden();
    await expect(page.getByTestId("feed-banner")).toBeVisible();
  }
});

test("keyboard focus shows a visible ring on the primary action", async ({
  page,
}) => {
  await gotoHome(page);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const play = page.getByRole("button", { name: /Play/ });
  await expect(play).toBeFocused();

  const outline = await play.evaluate((el) => {
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).not.toBe("0px");
});
