import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { jokerColor, type Card, type Rank, type Suit } from "../engine/cards";
import type { FeedEvent, FeedTone, CoachMsg, CoachTone } from "./feed";

const GLYPH: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  spades: "♠",
  clubs: "♣",
};

export function isRed(card: Card): boolean {
  return card.suit === "hearts" || card.suit === "diamonds";
}

export function rankBadge(rank: Card["rank"]): string | null {
  switch (rank) {
    case "J":
      return "JUMP";
    case "K":
      return "↺";
    case "Q":
    case "8":
      return "? +ans";
    case "A":
      return "★";
    case "2":
      return "+2";
    case "3":
      return "+3";
    case "JOKER":
      return "+5";
    default:
      return null;
  }
}

interface CardViewProps {
  card: Card;
  selected?: boolean;
  /** 1-based tap position within the current combo (shows a badge). */
  order?: number | null;
  hint?: boolean;
  large?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
}

/** Court-jester illustration, drawn in currentColor (red or black Joker). */
function JesterFace({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 72" class={className} role="img" aria-label="Joker">
      {/* three-point hat */}
      <path
        d="M6 26 Q2 10 13 15 Q15 4 24 11 Q33 4 35 15 Q46 10 42 26 Q34 21 24 23 Q14 21 6 26 Z"
        fill="currentColor"
      />
      {/* hat bells */}
      <circle cx="6" cy="27" r="3" fill="currentColor" />
      <circle cx="42" cy="27" r="3" fill="currentColor" />
      <circle cx="24" cy="10" r="2.4" fill="currentColor" />
      {/* face */}
      <circle
        cx="24"
        cy="38"
        r="11"
        fill="#fff"
        stroke="currentColor"
        stroke-width="2.6"
      />
      {/* eyes */}
      <circle cx="20" cy="36" r="1.7" fill="currentColor" />
      <circle cx="28" cy="36" r="1.7" fill="currentColor" />
      {/* grin */}
      <path
        d="M18 42 Q24 47 30 42"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      {/* ruff collar */}
      <path
        d="M12 52 L18 60 L24 52 L30 60 L36 52 L36 58 L12 58 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CardView({
  card,
  selected,
  order,
  hint,
  large,
  faceDown,
  onClick,
}: CardViewProps) {
  if (faceDown) {
    return (
      <div
        class={`rounded-lg border-2 border-yellow-400/60 bg-gradient-to-br from-green-800 to-green-950 shadow-md flex items-center justify-center ${
          large ? "w-20 h-28 text-2xl" : "w-12 h-[68px] text-lg"
        }`}
      >
        <span class="text-yellow-400/80">♛</span>
      </div>
    );
  }
  const red = isRed(card);
  const badge = rankBadge(card.rank);
  const joker = card.rank === "JOKER" ? (jokerColor(card) ?? "red") : null;
  return (
    <button
      type="button"
      onClick={onClick}
      class={`card-btn relative rounded-lg bg-white shadow-md border flex flex-col justify-between p-1 text-left ${
        large ? "w-20 h-28" : "w-14 h-20"
      } ${selected ? "border-yellow-400 ring-2 ring-yellow-400 -translate-y-2" : "border-gray-300"} ${
        hint && !selected ? "border-green-400" : ""
      } ${joker === "red" || red ? "text-red-600" : "text-gray-900"}`}
    >
      <div
        class={`font-bold leading-none tracking-tight ${joker ? (large ? "text-sm" : "text-[10px]") : large ? "text-lg" : "text-sm"}`}
      >
        {joker ? "JOKER" : card.rank}
        {card.suit !== "none" && (
          <span class="ml-0.5">{GLYPH[card.suit as Suit]}</span>
        )}
      </div>
      <div class="self-center leading-none">
        {joker ? (
          <JesterFace className={large ? "w-10 h-[60px]" : "w-8 h-12"} />
        ) : (
          <span class={large ? "text-3xl" : "text-2xl"}>
            {card.suit === "none" ? "★" : GLYPH[card.suit as Suit]}
          </span>
        )}
      </div>
      <div
        class={`leading-none ${large ? "text-[10px]" : "text-[8px]"} font-bold text-center rounded ${
          badge ? "bg-gray-900 text-yellow-300 px-1 py-0.5" : ""
        }`}
      >
        {badge ?? "\u00A0"}
      </div>
      {selected && order != null && (
        <span class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[11px] font-black text-gray-900 shadow">
          {order}
        </span>
      )}
    </button>
  );
}

export function Pill({
  children,
  tone = "slate",
}: {
  children: ComponentChildren;
  tone?: "slate" | "amber" | "red" | "green";
}) {
  const tones: Record<string, string> = {
    slate: "bg-white/10 text-white",
    amber: "bg-yellow-400 text-gray-900 font-bold",
    red: "bg-red-500 text-white font-bold",
    green: "bg-green-500 text-white font-bold",
  };
  return (
    <span
      class={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const SUIT_BUTTONS: { suit: Suit; glyph: string; red: boolean }[] = [
  { suit: "hearts", glyph: "♥", red: true },
  { suit: "diamonds", glyph: "♦", red: true },
  { suit: "spades", glyph: "♠", red: false },
  { suit: "clubs", glyph: "♣", red: false },
];

export function SuitPicker({
  onPick,
  onCancel,
}: {
  onPick: (s: Suit) => void;
  onCancel: () => void;
}) {
  return (
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        class="w-full max-w-sm rounded-2xl bg-green-950 border border-yellow-400/40 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p class="text-yellow-300 font-bold text-center mb-1">
          Ace played! Request which suit?
        </p>
        <p class="text-white/60 text-xs text-center mb-3">
          Next player must follow it
        </p>
        <div class="grid grid-cols-4 gap-2">
          {SUIT_BUTTONS.map(({ suit, glyph, red }) => (
            <button
              key={suit}
              type="button"
              onClick={() => onPick(suit)}
              class={`rounded-xl bg-white py-3 text-3xl font-bold ${red ? "text-red-600" : "text-gray-900"}`}
            >
              {glyph}
              <span class="block text-[10px] uppercase tracking-wide">
                {suit}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          class="mt-3 w-full rounded-xl bg-white/10 py-2 text-sm text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div class="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 anim-fly-in">
      <div class="rounded-full bg-gray-900/95 border border-yellow-400/50 px-4 py-2 text-sm font-semibold text-yellow-200 shadow-xl whitespace-nowrap">
        {message}
      </div>
    </div>
  );
}

const COACH_STYLE: Record<CoachTone, string> = {
  action: "border-amber-400/70 bg-amber-400/10 text-amber-100",
  ok: "border-green-400/60 bg-green-400/10 text-green-100",
  bad: "border-red-400/70 bg-red-500/15 text-red-100",
  wait: "border-white/10 bg-black/30 text-white/75",
  win: "border-yellow-400 bg-yellow-400/15 text-yellow-200",
};

/** Contextual turn line — always answers "what do I do now?". */
export function CoachBar({ msg }: { msg: CoachMsg }) {
  return (
    <p
      key={msg.text}
      class={`anim-fly-in mx-4 mb-1 flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-center text-xs font-bold ${COACH_STYLE[msg.tone]}`}
    >
      <span>{msg.icon}</span>
      <span>{msg.text}</span>
    </p>
  );
}

const TONE_BAR: Record<FeedTone, string> = {
  play: "border-white/15",
  penalty: "border-red-400/70",
  block: "border-green-400/70",
  suit: "border-green-400/70",
  demand: "border-yellow-400/70",
  skip: "border-yellow-400/50",
  reverse: "border-yellow-400/50",
  draw: "border-white/15",
  kadi: "border-yellow-400",
  win: "border-yellow-400",
  info: "border-white/15",
};

/** Latest game events as a banner (last two always visible); tap for full history. */
export function EventBanner({ events }: { events: FeedEvent[] }) {
  const [open, setOpen] = useState(false);
  if (events.length === 0) return null;
  const latest = events[events.length - 1];
  const previous = events.length > 1 ? events[events.length - 2] : null;
  const history = events.slice(-8).reverse();
  return (
    <div class="px-4 -mt-1 mb-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        class={`w-full rounded-xl bg-black/40 border ${TONE_BAR[latest.tone]} px-3 py-1.5 text-left active:scale-[0.99] transition`}
      >
        {previous && (
          <span class="block truncate text-[11px] text-white/55">
            {previous.icon} {previous.text}
          </span>
        )}
        <span
          key={events.length}
          class="anim-fly-in flex items-center gap-1.5 text-xs text-white/90"
        >
          <span>{latest.icon}</span>
          <span class="flex-1">{latest.text}</span>
          <span class="text-white/40 text-[10px]">
            {open ? "▲" : `📜 ${events.length}`}
          </span>
        </span>
      </button>
      {open && (
        <div class="mt-1 max-h-32 overflow-y-auto rounded-xl bg-black/50 border border-white/10 px-3 py-2 flex flex-col gap-1">
          {history.map((e, i) => (
            <p key={`${events.length}-${i}`} class="text-[11px] text-white/75">
              {e.icon} {e.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

const REQUEST_RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export function CardRequestPicker({
  hand,
  onPick,
  onCancel,
}: {
  hand: Card[];
  onPick: (rank: Rank, suit: Suit) => void;
  onCancel: () => void;
}) {
  const [rank, setRank] = useState<Rank | null>(null);
  const countOf = (r: Rank, suit?: Suit) =>
    hand.filter((c) => c.rank === r && (suit === undefined || c.suit === suit))
      .length;
  return (
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        class="w-full max-w-sm rounded-2xl bg-green-950 border border-yellow-400/40 p-4 max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p class="text-yellow-300 font-bold text-center">
          ⚡ SUPER ACE! Demand any card
        </p>
        <p class="text-white/60 text-xs text-center mb-1 mt-0.5">
          Step 1: rank {rank ? "✓" : ""} → Step 2: suit
        </p>
        <p class="text-yellow-200/70 text-[11px] text-center mb-3">
          ★ ranks are in your hand — rivals can&apos;t hold them
        </p>
        <div class="grid grid-cols-7 gap-1.5">
          {REQUEST_RANKS.map((r) => {
            const held = countOf(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRank(r)}
                class={`relative rounded-lg py-2 text-sm font-black ${rank === r ? "bg-yellow-400 text-gray-900" : held > 0 ? "bg-white text-gray-900 ring-2 ring-yellow-300" : "bg-white/60 text-gray-900"}`}
              >
                {held > 0 && rank !== r ? "★" : ""}
                {r}
                {held > 1 && (
                  <span class="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-400 px-0.5 text-[9px] font-black text-gray-900">
                    ×{held}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div class="grid grid-cols-4 gap-2 mt-3">
          {SUIT_BUTTONS.map(({ suit, glyph, red }) => {
            const heldHere = rank != null && countOf(rank, suit) > 0;
            return (
              <button
                key={suit}
                type="button"
                disabled={!rank}
                onClick={() => rank && onPick(rank, suit)}
                class={`rounded-xl bg-white py-3 text-3xl font-bold disabled:opacity-30 ${heldHere ? "ring-4 ring-yellow-400" : ""} ${red ? "text-red-600" : "text-gray-900"}`}
              >
                {glyph}
                <span class="block text-[10px] uppercase tracking-wide">
                  {suit}
                  {heldHere ? " ★" : ""}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onCancel}
          class="mt-3 w-full rounded-xl bg-white/10 py-2 text-sm text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function QuitConfirmModal({
  onClose,
  onExit,
  onSaveExit,
}: {
  onClose: () => void;
  onExit: () => void;
  onSaveExit: () => void;
}) {
  return (
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        class="relative w-full max-w-sm rounded-3xl bg-green-950 border border-yellow-400/40 p-6 text-center anim-fly-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          class="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg text-white active:scale-95 transition"
        >
          ✕
        </button>
        <div class="text-4xl">⏸</div>
        <h3 class="mt-2 text-xl font-black text-yellow-300">
          Quit this match?
        </h3>
        <p class="mt-1 text-sm text-white/70">
          Save to continue later from Home or exit and forfeit the match.
        </p>
        <button
          type="button"
          onClick={onSaveExit}
          class="mt-5 w-full rounded-2xl bg-yellow-400 py-3.5 font-black text-gray-900 active:scale-95 transition"
        >
          Save &amp; exit
        </button>
        <button
          type="button"
          onClick={onExit}
          class="mt-2 w-full rounded-2xl bg-white/10 py-3 text-sm font-bold text-red-300 active:scale-95 transition"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
