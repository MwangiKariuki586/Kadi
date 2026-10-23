import { useRef, useState } from "preact/hooks";
import { useDialogFocus } from "./dialogFocus";
import { Icon } from "./icons";
import {
  dismissInstall,
  getInstallGuidance,
  promptInstall,
  shouldOfferInstall,
  useInstall,
  type InstallGuidance,
} from "./install";
import { Panel } from "./theme";

export type InstallGuide =
  | "chrome-menu"
  | "ios-share"
  | "open-in-browser"
  | "other-browser";

interface GuideCopy {
  title: string;
  intro: string;
  steps: readonly string[];
  note: string;
}

const GUIDES: Record<InstallGuide, GuideCopy> = {
  "chrome-menu": {
    title: "Install Kadi",
    intro:
      "In Chrome or Edge, open the menu and choose Install app or Add to Home screen.",
    steps: [
      "Open the ⋮ menu in your browser.",
      "Choose Install app or Add to Home screen.",
      "Confirm — Kadi opens full-screen.",
    ],
    note: "On a computer, use the install icon in the address bar.",
  },
  "ios-share": {
    title: "Add Kadi to Home Screen",
    intro:
      "Install Kadi from Safari — it opens full-screen and works offline.",
    steps: [
      "If you're in Chrome or Firefox, open this page in Safari.",
      "Tap Share, then Add to Home Screen.",
      "Tap Add — Kadi appears on your Home Screen.",
    ],
    note: "Full-screen play, no App Store needed.",
  },
  "open-in-browser": {
    title: "Open Kadi in your browser",
    intro:
      "You're inside another app's browser. Open Kadi in Chrome or Safari to install it.",
    steps: [
      "Tap the ⋮ or Share menu.",
      "Choose Open in browser.",
      "Install Kadi from the browser menu.",
    ],
    note: "WhatsApp, Instagram and TikTok browsers can't install apps.",
  },
  "other-browser": {
    title: "Use Chrome or Edge",
    intro:
      "This browser can't install Kadi. Open this page in Chrome or Edge to install the app.",
    steps: [
      "Copy this page's address.",
      "Open it in Chrome or Edge.",
      "Choose Install from the menu or address bar.",
    ],
    note: "On a Mac, Safari can also add Kadi via File → Add to Dock.",
  },
};

function guideFor(guidance: InstallGuidance): InstallGuide {
  if (guidance === "native" || guidance === "none") return "chrome-menu";
  return guidance;
}

async function activateInstall(openHelp: () => void): Promise<void> {
  const outcome = await promptInstall();
  if (outcome === "unavailable") openHelp();
}

export function InstallButton() {
  const install = useInstall();
  const guidance = getInstallGuidance(install);
  const [helpOpen, setHelpOpen] = useState(false);

  if (guidance === "none") return null;

  return (
    <>
      <button
        type="button"
        data-testid="install-button"
        aria-label="Install Kadi"
        onClick={() => void activateInstall(() => setHelpOpen(true))}
        class="inline-flex h-11 items-center gap-1.5 rounded-xl border border-kadi-gold/45 bg-kadi-gold/10 px-3 text-xs font-black text-kadi-gold transition hover:border-kadi-gold/80 hover:bg-kadi-gold/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kadi-gold active:scale-95"
      >
        <Icon name="download" class="h-4 w-4" />
        Install
      </button>
      {helpOpen && (
        <InstallHelpSheet
          guidance={guideFor(guidance)}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </>
  );
}

export function InstallCard({
  games,
  placement,
}: {
  games: number;
  placement: "mobile" | "desktop";
}) {
  const install = useInstall();
  const guidance = getInstallGuidance(install);
  const [helpOpen, setHelpOpen] = useState(false);
  const visible =
    guidance !== "none" &&
    shouldOfferInstall({
      games,
      dismissedAt: install.dismissedAt,
      now: Date.now(),
      installed: install.installed,
    });

  if (!visible) return null;

  const titleId = `install-card-title-${placement}`;
  const desktop = placement === "desktop";
  const title =
    guidance === "ios-share" ? "Add Kadi to Home Screen" : "Install Kadi";

  return (
    <div
      role="region"
      aria-labelledby={titleId}
      data-testid={`install-card-${placement}`}
    >
      <Panel
        strong
        class={`relative overflow-hidden p-4 ${
          desktop ? "flex items-center gap-4" : ""
        }`}
      >
        <div class="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-kadi-gold/10 blur-xl" />
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-kadi-gold/40 bg-kadi-gold/10 text-kadi-gold">
          <Icon name="download" class="h-5 w-5" />
        </span>
        <div class="min-w-0 flex-1">
          <h3
            id={titleId}
            class={`text-sm font-black text-white ${desktop ? "" : "mt-2"}`}
          >
            {title}
          </h3>
          <p class="mt-1 text-[11px] leading-relaxed text-white/55">
            Full-screen, offline play — one tap from your home screen. No app
            store needed.
          </p>
        </div>
        <div
          class={
            desktop
              ? "flex w-40 shrink-0 flex-col items-stretch gap-1"
              : "mt-3"
          }
        >
          <button
            type="button"
            data-testid={`install-cta-${placement}`}
            onClick={() => void activateInstall(() => setHelpOpen(true))}
            class="kadi-gold-button flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black"
          >
            <Icon name="download" class="h-4 w-4" />
            {guidance === "native" ? "Install app" : "How to install"}
          </button>
          <div class={desktop ? "text-center" : "mt-2 flex justify-center"}>
            <button
              type="button"
              data-testid={`install-dismiss-${placement}`}
              onClick={dismissInstall}
              class="rounded-lg px-2 py-1 text-[11px] font-bold text-white/45 transition hover:text-white/70"
            >
              Not now
            </button>
          </div>
        </div>
      </Panel>
      {helpOpen && (
        <InstallHelpSheet
          guidance={guideFor(guidance)}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </div>
  );
}

export function InstallSettingsRow() {
  const install = useInstall();
  const guidance = getInstallGuidance(install);
  const [helpOpen, setHelpOpen] = useState(false);

  if (install.installed) {
    return (
      <div
        data-testid="install-settings-row"
        class="flex items-center gap-3 rounded-2xl border border-kadi-gold/60 bg-kadi-gold/10 p-3"
      >
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-kadi-gold/40 bg-kadi-gold/15 text-kadi-gold">
          <Icon name="check" class="h-4 w-4" strokeWidth={2.4} />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-bold text-white">Installed</span>
          <span class="mt-0.5 block text-[11px] leading-snug text-white/50">
            Kadi lives on your home screen.
          </span>
        </span>
      </div>
    );
  }

  if (guidance === "none") return null;

  const label =
    guidance === "ios-share"
      ? "Add to Home Screen"
      : guidance === "open-in-browser"
        ? "Open in Chrome or Safari"
        : guidance === "other-browser"
          ? "Install in Chrome or Edge"
          : "Add to home screen";

  return (
    <>
      <button
        type="button"
        data-testid="install-settings-row"
        onClick={() => void activateInstall(() => setHelpOpen(true))}
        class="flex w-full items-center gap-3 rounded-2xl border border-kadi-line/45 bg-kadi-deep/30 p-3 text-left transition hover:border-kadi-gold/40 active:scale-[0.99]"
      >
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-kadi-gold/40 bg-kadi-gold/10 text-kadi-gold">
          <Icon name="download" class="h-4 w-4" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-bold text-white">{label}</span>
          <span class="mt-0.5 block text-[11px] leading-snug text-white/50">
            Full-screen, offline play in one tap.
          </span>
        </span>
        <span class="shrink-0 text-xs font-black text-kadi-gold">
          {guidance === "native" ? "Install" : "Guide"}
        </span>
      </button>
      {helpOpen && (
        <InstallHelpSheet
          guidance={guideFor(guidance)}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </>
  );
}

export function InstallHelpSheet({
  guidance,
  onClose,
}: {
  guidance: InstallGuide;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeRef);
  const copy = GUIDES[guidance];

  return (
    <div
      class="fixed inset-0 z-[60] flex items-end justify-center bg-kadi-deep/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-help-title"
        data-testid="install-help"
        class="kadi-panel-strong anim-fly-in relative w-full max-w-sm rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          class="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 active:scale-95"
        >
          <Icon name="x" class="h-4 w-4" />
        </button>
        <span class="mx-auto grid h-14 w-14 place-items-center rounded-full border border-kadi-gold/40 bg-kadi-gold/10 text-kadi-gold">
          <Icon name="download" class="h-7 w-7" />
        </span>
        <h3
          id="install-help-title"
          class="mt-3 text-center text-xl font-black text-white"
        >
          {copy.title}
        </h3>
        <p class="mt-1 text-center text-sm leading-relaxed text-white/60">
          {copy.intro}
        </p>
        <ol class="mt-4 flex flex-col gap-2 text-left">
          {copy.steps.map((step, index) => (
            <li
              key={step}
              class="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/5 px-3 py-2"
            >
              <span class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-kadi-gold/15 text-[10px] font-black text-kadi-gold">
                {index + 1}
              </span>
              <span class="text-[11px] leading-relaxed text-white/65">
                {step}
              </span>
            </li>
          ))}
        </ol>
        <p class="mt-3 text-center text-[11px] leading-relaxed text-white/40">
          {copy.note}
        </p>
        <button
          type="button"
          onClick={onClose}
          class="kadi-gold-button mt-5 w-full rounded-2xl py-3 font-black"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
