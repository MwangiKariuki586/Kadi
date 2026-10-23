import { describe, expect, it } from "vitest";
import {
  detectPlatform,
  getInstallGuidance,
  INSTALL_DISMISS_MS,
  isStandaloneMode,
  readDismissedAt,
  readInstalled,
  shouldOfferInstall,
  writeDismissedAt,
  writeInstalled,
  type InstallStorage,
} from "./install";

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IOS_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1";
const IPHONE_WHATSAPP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.24.6 A";
const IPAD_DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const FIREFOX_ANDROID =
  "Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0";
const WHATSAPP_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.6 A";
const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.0.0 Mobile Safari/537.36";

function fakeStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: InstallStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
  return { storage, values };
}

describe("detectPlatform", () => {
  it("recognises installable Chromium browsers", () => {
    expect(detectPlatform({ userAgent: ANDROID_CHROME })).toBe("chromium");
    expect(detectPlatform({ userAgent: DESKTOP_CHROME })).toBe("chromium");
    expect(
      detectPlatform({
        userAgent: `${ANDROID_CHROME} SamsungBrowser/24.0`,
      }),
    ).toBe("chromium");
    expect(
      detectPlatform({ userAgent: `${ANDROID_CHROME} EdgA/123.0` }),
    ).toBe("chromium");
  });

  it("detects iOS, including third-party browsers and iPad desktop-mode UAs", () => {
    expect(detectPlatform({ userAgent: IPHONE_SAFARI })).toBe("ios");
    expect(detectPlatform({ userAgent: IOS_CHROME })).toBe("ios");
    expect(
      detectPlatform({
        userAgent: IPAD_DESKTOP_UA,
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe("ios");
  });

  it("skips browsers without the install event", () => {
    expect(detectPlatform({ userAgent: FIREFOX_ANDROID })).toBe("other");
  });

  it("flags in-app browsers and WebViews before OS detection", () => {
    expect(detectPlatform({ userAgent: WHATSAPP_ANDROID })).toBe("in-app");
    expect(detectPlatform({ userAgent: IPHONE_WHATSAPP })).toBe("in-app");
    expect(detectPlatform({ userAgent: ANDROID_WEBVIEW })).toBe("in-app");
  });
});

describe("getInstallGuidance", () => {
  const base = { canPrompt: false, installed: false };

  it("uses the native prompt on Chromium once it is captured", () => {
    expect(
      getInstallGuidance({ ...base, platform: "chromium", canPrompt: true }),
    ).toBe("native");
  });

  it("falls back to browser-menu steps on Chromium", () => {
    expect(getInstallGuidance({ ...base, platform: "chromium" })).toBe(
      "chrome-menu",
    );
  });

  it("routes iOS and in-app browsers to their own guides", () => {
    expect(getInstallGuidance({ ...base, platform: "ios" })).toBe("ios-share");
    expect(getInstallGuidance({ ...base, platform: "in-app" })).toBe(
      "open-in-browser",
    );
  });

  it("points unsupported browsers elsewhere", () => {
    expect(getInstallGuidance({ ...base, platform: "other" })).toBe(
      "other-browser",
    );
  });

  it("hides every surface once installed", () => {
    expect(
      getInstallGuidance({
        platform: "chromium",
        canPrompt: true,
        installed: true,
      }),
    ).toBe("none");
  });
});

describe("isStandaloneMode", () => {
  it("treats standalone, fullscreen, minimal-ui and iOS standalone as installed", () => {
    expect(isStandaloneMode({ standalone: true })).toBe(true);
    expect(isStandaloneMode({ standalone: false, fullscreen: true })).toBe(
      true,
    );
    expect(isStandaloneMode({ standalone: false, minimalUi: true })).toBe(
      true,
    );
    expect(
      isStandaloneMode({ standalone: false, iosStandalone: true }),
    ).toBe(true);
  });

  it("stays false in a regular browser tab", () => {
    expect(isStandaloneMode({ standalone: false })).toBe(false);
  });
});

describe("shouldOfferInstall", () => {
  const now = 1_700_000_000_000;

  it("waits until the player has finished a match", () => {
    expect(
      shouldOfferInstall({
        games: 0,
        dismissedAt: null,
        now,
        installed: false,
      }),
    ).toBe(false);
    expect(
      shouldOfferInstall({
        games: 1,
        dismissedAt: null,
        now,
        installed: false,
      }),
    ).toBe(true);
  });

  it("hides the card once installed", () => {
    expect(
      shouldOfferInstall({
        games: 5,
        dismissedAt: null,
        now,
        installed: true,
      }),
    ).toBe(false);
  });

  it("honours the dismissal cooldown", () => {
    expect(
      shouldOfferInstall({
        games: 5,
        dismissedAt: now - 1_000,
        now,
        installed: false,
      }),
    ).toBe(false);
    expect(
      shouldOfferInstall({
        games: 5,
        dismissedAt: now - INSTALL_DISMISS_MS,
        now,
        installed: false,
      }),
    ).toBe(true);
  });
});

describe("install storage", () => {
  it("round-trips a dismissal timestamp", () => {
    const { storage } = fakeStorage();
    writeDismissedAt(storage, 1234);
    expect(readDismissedAt(storage)).toBe(1234);
  });

  it("ignores corrupt or missing values", () => {
    expect(readDismissedAt(fakeStorage().storage)).toBeNull();
    expect(
      readDismissedAt(fakeStorage({ "kadi-install-dismissed-at": "nope" }).storage),
    ).toBeNull();
    expect(
      readDismissedAt(fakeStorage({ "kadi-install-dismissed-at": "0" }).storage),
    ).toBeNull();
  });

  it("round-trips the installed flag", () => {
    const { storage } = fakeStorage();
    expect(readInstalled(storage)).toBe(false);
    writeInstalled(storage);
    expect(readInstalled(storage)).toBe(true);
  });
});
