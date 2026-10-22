export type ShortcutLayer = "game" | "modal" | "help";

export type GameShortcut = "play" | "pick" | "kadi" | "dismiss" | "help";

export interface KeyInput {
  key: string;
  code?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  target?: unknown;
}

function isHelpKey(input: KeyInput): boolean {
  return input.key === "?" || (input.code === "Slash" && input.shiftKey === true);
}

/** Text entry should always win over single-key game shortcuts. */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof el.tagName === "string" ? el.tagName.toLowerCase() : "";
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable === true
  );
}

/**
 * Map a keydown to a game action. Dialogs own Escape; help also owns "?".
 * Browser/OS chords and key repeats are deliberately ignored.
 */
export function resolveGameShortcut(
  input: KeyInput,
  layer: ShortcutLayer,
): GameShortcut | null {
  if (input.ctrlKey || input.metaKey || input.altKey || input.repeat) {
    return null;
  }
  if (isTypingTarget(input.target)) return null;

  if (layer === "help") {
    return input.key === "Escape" || isHelpKey(input) ? "dismiss" : null;
  }

  if (layer === "modal") {
    return input.key === "Escape" ? "dismiss" : null;
  }

  if (isHelpKey(input)) return "help";

  switch (input.key.toLowerCase()) {
    case "p":
      return "play";
    case "d":
      return "pick";
    case "k":
      return "kadi";
    case "escape":
      return "dismiss";
    default:
      return null;
  }
}
