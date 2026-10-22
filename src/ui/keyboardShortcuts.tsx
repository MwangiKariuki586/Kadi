import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { resolveGameShortcut, type GameShortcut, type ShortcutLayer } from "./keyboard";
import { useDialogFocus } from "./dialogFocus";
import { Icon } from "./icons";

export function GameShortcutLayer({
  layer,
  onAction,
}: {
  layer: ShortcutLayer;
  onAction: (action: GameShortcut) => void;
}) {
  const latest = useRef({ layer, onAction });
  latest.current = { layer, onAction };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const action = resolveGameShortcut(event, latest.current.layer);
      if (!action) return;
      event.preventDefault();
      latest.current.onAction(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}

export function Kbd({ children }: { children: ComponentChildren }) {
  return (
    <kbd class="inline-flex min-w-7 items-center justify-center rounded-md border border-white/15 bg-white/8 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white shadow-sm">
      {children}
    </kbd>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["P"], label: "Play selected cards" },
  { keys: ["D"], label: "Pick, draw, or accept a penalty" },
  { keys: ["K"], label: "Declare KADI" },
  { keys: ["Esc"], label: "Close a dialog or clear selection" },
  { keys: ["?"], label: "Open or close this panel" },
];

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeRef);

  return (
    <div
      class="fixed inset-0 z-[60] flex items-end justify-center bg-kadi-deep/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        data-testid="shortcuts-dialog"
        class="kadi-panel-strong anim-fly-in relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl p-5 text-left sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close keyboard shortcuts"
          class="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 active:scale-95"
        >
          <Icon name="x" class="h-4 w-4" />
        </button>
        <span class="mx-auto grid h-12 w-12 place-items-center rounded-full border border-kadi-gold/35 bg-kadi-gold/10 font-mono text-xl font-black text-kadi-gold">
          ?
        </span>
        <h3
          id="shortcuts-title"
          class="mt-2 text-center text-xl font-black text-kadi-gold"
        >
          Keyboard shortcuts
        </h3>
        <p class="mt-1 text-center text-xs text-white/55">
          Built for the desktop table. Your hand stays fully keyboard-friendly.
        </p>

        <dl class="mt-5 space-y-2">
          {SHORTCUTS.map(({ keys, label }) => (
            <div
              key={label}
              class="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/4 px-3 py-2"
            >
              <dt class="flex shrink-0 items-center gap-1">
                {keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dt>
              <dd class="text-right text-xs font-semibold text-white/75">
                {label}
              </dd>
            </div>
          ))}
        </dl>

        <p class="mt-4 rounded-xl border border-kadi-line/40 bg-kadi-deep/45 px-3 py-2 text-center text-[11px] leading-relaxed text-white/55">
          Use Tab and Shift+Tab to move around. Press Enter or Space on a
          focused card to select it.
        </p>

        <button
          type="button"
          onClick={onClose}
          class="kadi-gold-button mt-4 w-full rounded-2xl py-3 font-black active:scale-95"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
