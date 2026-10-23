import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const svg = await readFile(
  new URL("../public/pwa-512x512.svg", import.meta.url),
  "utf8",
);
const iconsDir = new URL("../public/icons/", import.meta.url);
const publicDir = new URL("../public/", import.meta.url);

await mkdir(iconsDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(size, file, { scale = 1, background = null } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * scale);
  const artwork = svg.replace(
    "<svg ",
    `<svg width="${inner}" height="${inner}" `,
  );
  const fill = background ?? "transparent";
  await page.setContent(
    `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;overflow:hidden;background:${fill}">${artwork}</body></html>`,
  );
  await page.screenshot({
    path: fileURLToPath(new URL(file, publicDir)),
    omitBackground: background === null,
  });
}

await render(192, "icons/icon-192.png");
await render(512, "icons/icon-512.png");
await render(512, "icons/icon-maskable-512.png", {
  scale: 0.8,
  background: "#05251a",
});
await render(180, "apple-touch-icon.png", {
  scale: 0.9,
  background: "#05251a",
});

await browser.close();
