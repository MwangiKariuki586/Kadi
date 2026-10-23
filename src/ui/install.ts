import { useEffect, useState } from "preact/hooks";

export type InstallPlatform = "chromium" | "ios" | "in-app" | "other";

export type InstallGuidance =
  | "native"
  | "chrome-menu"
  | "ios-share"
  | "open-in-browser"
  | "other-browser"
  | "none";

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

export interface InstallSnapshot {
  platform: InstallPlatform;
  canPrompt: boolean;
  installed: boolean;
  dismissedAt: number | null;
}

export interface InstallStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PlatformInput {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}

interface InstallPromptEvent extends Event {
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISSED_KEY = "kadi-install-dismissed-at";
const INSTALLED_KEY = "kadi-installed";

export const INSTALL_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

const IOS_RE = /iPad|iPhone|iPod/;
const NON_INSTALLABLE_RE =
  /UCBrowser|Opera Mini|OPiOS|FxiOS|CriOS/;
const IN_APP_RE =
  /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|Pinterest|MicroMessenger|; wv\)/i;
const CHROMIUM_RE = /Chrome\/|Chromium\/|EdgA?\/|OPR\/|SamsungBrowser\//;

export function detectPlatform(input: PlatformInput): InstallPlatform {
  const ua = input.userAgent;
  const ios =
    IOS_RE.test(ua) ||
    (input.platform === "MacIntel" && (input.maxTouchPoints ?? 0) > 1);
  if (IN_APP_RE.test(ua)) return "in-app";
  if (ios) return "ios";
  if (NON_INSTALLABLE_RE.test(ua)) return "other";
  if (!CHROMIUM_RE.test(ua)) return "other";
  return "chromium";
}

export function getInstallGuidance(
  snapshot: Pick<InstallSnapshot, "platform" | "canPrompt" | "installed">,
): InstallGuidance {
  if (snapshot.installed) return "none";
  if (snapshot.platform === "chromium") {
    return snapshot.canPrompt ? "native" : "chrome-menu";
  }
  if (snapshot.platform === "ios") return "ios-share";
  if (snapshot.platform === "in-app") return "open-in-browser";
  return "other-browser";
}

export function isStandaloneMode(input: {
  standalone: boolean;
  fullscreen?: boolean;
  minimalUi?: boolean;
  iosStandalone?: boolean;
}): boolean {
  return Boolean(
    input.standalone ||
      input.fullscreen ||
      input.minimalUi ||
      input.iosStandalone,
  );
}

export function shouldOfferInstall(input: {
  games: number;
  dismissedAt: number | null;
  now: number;
  installed: boolean;
}): boolean {
  if (input.installed) return false;
  if (input.games < 1) return false;
  if (
    input.dismissedAt !== null &&
    input.now - input.dismissedAt < INSTALL_DISMISS_MS
  ) {
    return false;
  }
  return true;
}

export function readDismissedAt(storage: InstallStorage): number | null {
  const raw = storage.getItem(DISMISSED_KEY);
  if (!raw) return null;
  const at = Number(raw);
  return Number.isFinite(at) && at > 0 ? at : null;
}

export function writeDismissedAt(storage: InstallStorage, at: number): void {
  storage.setItem(DISMISSED_KEY, String(at));
}

export function readInstalled(storage: InstallStorage): boolean {
  return storage.getItem(INSTALLED_KEY) === "1";
}

export function writeInstalled(storage: InstallStorage): void {
  storage.setItem(INSTALLED_KEY, "1");
}

const browserStorage: InstallStorage = {
  getItem(key) {
    try {
      return typeof window === "undefined"
        ? null
        : window.localStorage.getItem(key);
    } catch {
      /* Storage can be blocked (private mode, policy). */
      return null;
    }
  },
  setItem(key, value) {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
      }
    } catch {
      /* Persistence is a nicety; the prompt still works without it. */
    }
  },
};

let snapshot: InstallSnapshot = {
  platform: "other",
  canPrompt: false,
  installed: false,
  dismissedAt: null,
};

let deferred: InstallPromptEvent | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function update(patch: Partial<InstallSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  emit();
}

function standaloneNow(): boolean {
  if (typeof window === "undefined") return false;
  const media = (query: string) =>
    typeof window.matchMedia === "function" &&
    window.matchMedia(query).matches;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return isStandaloneMode({
    standalone: media("(display-mode: standalone)"),
    fullscreen: media("(display-mode: fullscreen)"),
    minimalUi: media("(display-mode: minimal-ui)"),
    iosStandalone: nav.standalone === true,
  });
}

export function initInstallPrompt(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const nav = window.navigator;
  const installed = standaloneNow() || readInstalled(browserStorage);
  snapshot = {
    platform: detectPlatform({
      userAgent: nav.userAgent,
      platform: nav.platform,
      maxTouchPoints: nav.maxTouchPoints,
    }),
    canPrompt: false,
    installed,
    dismissedAt: readDismissedAt(browserStorage),
  };

  const onBeforeInstall = (event: Event) => {
    event.preventDefault();
    const promptEvent = event as InstallPromptEvent;
    if (typeof promptEvent.prompt !== "function") return;
    deferred = promptEvent;
    update({ canPrompt: true });
  };

  const onInstalled = () => {
    deferred = null;
    writeInstalled(browserStorage);
    update({ canPrompt: false, installed: true });
  };

  const onDisplayModeChange = () => {
    if (!standaloneNow()) return;
    writeInstalled(browserStorage);
    update({ installed: true });
  };

  window.addEventListener("beforeinstallprompt", onBeforeInstall);
  window.addEventListener("appinstalled", onInstalled);
  if (typeof window.matchMedia === "function") {
    const queries = [
      window.matchMedia("(display-mode: standalone)"),
      window.matchMedia("(display-mode: fullscreen)"),
      window.matchMedia("(display-mode: minimal-ui)"),
    ];
    for (const query of queries) {
      query.addEventListener?.("change", onDisplayModeChange);
    }
  }

  emit();
}

export function getInstallSnapshot(): InstallSnapshot {
  return snapshot;
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInstall(): InstallSnapshot {
  const [state, setState] = useState(getInstallSnapshot);
  useEffect(() => {
    setState(getInstallSnapshot());
    return subscribeInstall(() => setState(getInstallSnapshot()));
  }, []);
  return state;
}

export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  update({ canPrompt: false });
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      writeInstalled(browserStorage);
      update({ installed: true });
      return "accepted";
    }
    dismissInstall();
    return "dismissed";
  } catch {
    return "unavailable";
  }
}

export function dismissInstall(): void {
  const now = Date.now();
  writeDismissedAt(browserStorage, now);
  update({ dismissedAt: now });
}

initInstallPrompt();
