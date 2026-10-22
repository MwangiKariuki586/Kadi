import { describe, expect, it } from "vitest";
import {
  isTypingTarget,
  resolveGameShortcut,
  type KeyInput,
} from "./keyboard";

function press(key: string, extra: Omit<KeyInput, "key"> = {}): KeyInput {
  return { key, ...extra };
}

describe("isTypingTarget", () => {
  it("detects form fields and contenteditable hosts", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "textarea" })).toBe(true);
    expect(isTypingTarget({ tagName: "select" })).toBe(true);
    expect(isTypingTarget({ isContentEditable: true })).toBe(true);
  });

  it("ignores ordinary elements and empty targets", () => {
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({})).toBe(false);
  });
});

describe("resolveGameShortcut", () => {
  it("maps the gameplay keys case-insensitively", () => {
    expect(resolveGameShortcut(press("p"), "game")).toBe("play");
    expect(resolveGameShortcut(press("P"), "game")).toBe("play");
    expect(resolveGameShortcut(press("d"), "game")).toBe("pick");
    expect(resolveGameShortcut(press("K"), "game")).toBe("kadi");
  });

  it("maps escape and help", () => {
    expect(resolveGameShortcut(press("Escape"), "game")).toBe("dismiss");
    expect(resolveGameShortcut(press("?"), "game")).toBe("help");
    expect(
      resolveGameShortcut(
        press("/", { code: "Slash", shiftKey: true }),
        "game",
      ),
    ).toBe("help");
  });

  it("ignores unrelated keys and modified chords", () => {
    expect(resolveGameShortcut(press("x"), "game")).toBeNull();
    expect(resolveGameShortcut(press("p", { ctrlKey: true }), "game")).toBeNull();
    expect(resolveGameShortcut(press("d", { metaKey: true }), "game")).toBeNull();
    expect(resolveGameShortcut(press("k", { altKey: true }), "game")).toBeNull();
  });

  it("ignores key repeats and typing targets", () => {
    expect(resolveGameShortcut(press("p", { repeat: true }), "game")).toBeNull();
    expect(
      resolveGameShortcut(
        press("d", { target: { tagName: "INPUT" } }),
        "game",
      ),
    ).toBeNull();
  });

  it("lets a modal own escape but not gameplay keys", () => {
    expect(resolveGameShortcut(press("Escape"), "modal")).toBe("dismiss");
    expect(resolveGameShortcut(press("p"), "modal")).toBeNull();
    expect(resolveGameShortcut(press("k"), "modal")).toBeNull();
  });

  it("closes help with escape or a second question mark", () => {
    expect(resolveGameShortcut(press("Escape"), "help")).toBe("dismiss");
    expect(resolveGameShortcut(press("?"), "help")).toBe("dismiss");
    expect(resolveGameShortcut(press("p"), "help")).toBeNull();
  });
});
