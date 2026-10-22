import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import {
  cardLabel,
  jokerColor,
  type Card,
  type Rank,
  type Suit,
} from "../engine/cards";
import {
  groupFeed,
  type CoachMsg,
  type CoachTone,
  type FeedEvent,
  type FeedTone,
  type TurnGroup,
} from "./feed";
import { describeRules } from "../engine/rules";
import { Icon } from "./icons";
import { Avatar } from "./theme";

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
  const sizeClass = large
    ? "w-20 h-28 md:w-24 md:h-32 lg:w-28 lg:h-40"
    : "w-14 h-20 md:w-16 md:h-24 lg:w-20 lg:h-28";
  if (faceDown) {
    return (
      <div
        class={`kadi-card-back relative flex items-center justify-center overflow-hidden rounded-lg shadow-[0_8px_18px_rgba(0,0,0,0.4)] ${sizeClass}`}
        role="img"
        aria-label="Face-down card"
      >
        <span class="absolute inset-1.5 rounded border border-kadi-gold/25" />
        <span class="flex flex-col items-center gap-0.5 text-kadi-gold">
          <span
            class={`font-black leading-none ${
              large ? "text-2xl lg:text-3xl" : "text-lg lg:text-xl"
            }`}
          >
            K
          </span>
          <span class="text-[7px] font-black uppercase tracking-[0.2em] text-kadi-gold/70">
            Kadi
          </span>
          <span class={large ? "text-lg" : "text-xs"}>♠</span>
        </span>
      </div>
    );
  }
  const red = isRed(card);
  const badge = rankBadge(card.rank);
  const joker = card.rank === "JOKER" ? (jokerColor(card) ?? "red") : null;
  const ink = joker === "red" || red ? "text-[#b3261e]" : "text-[#15251b]";
  const className = `card-btn relative flex flex-col justify-between rounded-lg border p-1.5 text-left kadi-card-face shadow-[0_7px_16px_rgba(0,0,0,0.32)] ${sizeClass} ${
    selected
      ? "z-10 border-kadi-gold ring-2 ring-kadi-gold -translate-y-2 shadow-[0_18px_30px_rgba(0,0,0,0.4),0_0_18px_rgba(245,197,24,0.22)]"
      : `${
          onClick ? "hover:-translate-y-1 hover:shadow-[0_14px_24px_rgba(0,0,0,0.4)]" : ""
        } ${hint && !selected ? "border-kadi-gold/70" : ""}`
  } ${ink}`;
  const corner = (rotate = false) => (
    <span
      class={`flex flex-col items-center leading-none ${rotate ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <span
        class={`font-black tracking-tight ${
          joker
            ? large
              ? "text-[9px] md:text-[10px] lg:text-[11px]"
              : "text-[7px] md:text-[8px]"
            : large
              ? "text-base md:text-lg lg:text-xl"
              : "text-xs md:text-sm lg:text-base"
        }`}
      >
        {joker ? "JOKER" : card.rank}
      </span>
      {card.suit !== "none" && (
        <span
          class={
            large
              ? "text-sm md:text-base lg:text-lg"
              : "text-[11px] md:text-xs lg:text-sm"
          }
        >
          {GLYPH[card.suit as Suit]}
        </span>
      )}
    </span>
  );
  const content = (
    <>
      <div class="flex items-start justify-between">
        {corner()}
        {joker && (
          <span class="rounded-full border border-current/20 px-1 py-0.5 text-[7px] font-black tracking-widest">
            +5
          </span>
        )}
      </div>
      <div class="absolute inset-0 flex items-center justify-center">
        {joker ? (
          <JesterFace
            className={
              large
                ? "w-10 h-[60px] md:w-12 md:h-[72px] lg:w-14 lg:h-[84px]"
                : "w-8 h-12 md:w-9 md:h-14 lg:w-10 lg:h-16"
            }
          />
        ) : (
          <span
            class={
              large
                ? "text-3xl md:text-4xl lg:text-5xl"
                : "text-2xl md:text-3xl lg:text-4xl"
            }
            aria-hidden="true"
          >
            {card.suit === "none" ? "★" : GLYPH[card.suit as Suit]}
          </span>
        )}
      </div>
      <div class="flex items-end justify-between">
        {badge ? (
          <span
            class={`rounded border border-kadi-gold/40 bg-kadi-ink px-1 py-0.5 font-black leading-none text-kadi-gold ${
              large
                ? "text-[10px] md:text-[11px] lg:text-xs"
                : "text-[8px] md:text-[9px] lg:text-[10px]"
            }`}
          >
            {badge}
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        {corner(true)}
      </div>
      {selected && order != null && (
        <span class="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-kadi-gold-bright/70 bg-kadi-gold text-[11px] font-black text-kadi-ink shadow">
          {order}
        </span>
      )}
    </>
  );

  if (!onClick) {
    return (
      <div class={className} role="img" aria-label={cardLabel(card)}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={cardLabel(card)}
      aria-pressed={selected === true}
      class={className}
    >
      {content}
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
    slate: "border-white/10 bg-white/8 text-white/85",
    amber: "border-kadi-gold/60 bg-kadi-gold/15 text-kadi-gold",
    red: "border-red-400/40 bg-red-500/15 text-red-200",
    green: "border-emerald-400/35 bg-emerald-400/12 text-emerald-200",
  };
  return (
    <span
      class={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function OpponentSeat({
  name,
  cards,
  isTurn,
  thinking,
  kadi,
  slot,
  className = "",
}: {
  name: string;
  cards: number;
  isTurn: boolean;
  thinking: boolean;
  kadi: boolean;
  slot: "left" | "top" | "right";
  className?: string;
}) {
  return (
    <div
      data-testid={`seat-${slot}`}
      aria-current={isTurn ? "true" : undefined}
      class={`flex min-w-0 w-full max-w-xs items-center gap-2 rounded-2xl border px-3 py-2 transition lg:max-w-[12rem] lg:px-4 lg:py-3 ${className} ${
        isTurn
          ? "border-kadi-gold/75 bg-kadi-gold/10 shadow-[0_0_22px_rgba(245,197,24,0.12)]"
          : "border-kadi-line/45 bg-kadi-deep/45"
      }`}
    >
      <Avatar name={name} size="md" highlight={isTurn} />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1 truncate text-xs font-bold md:text-sm">
          <span class="truncate">{name}</span>
          {kadi && (
            <span class="shrink-0 text-[9px] font-black tracking-widest text-kadi-gold">
              KADI!
            </span>
          )}
        </div>
        <div class="flex items-center gap-1 text-[11px] text-white/55 md:text-xs">
          <span aria-hidden="true">🂠</span>
          {thinking ? "thinking…" : `${cards} cards`}
        </div>
      </div>
      {isTurn && (
        <span
          aria-hidden="true"
          class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-kadi-gold"
        />
      )}
    </div>
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
      class="fixed inset-0 z-50 flex items-end justify-center bg-kadi-deep/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a suit"
        class="kadi-panel-strong max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-2xl p-4 md:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <p class="mb-1 text-center font-bold text-kadi-gold">
          Ace played! Request which suit?
        </p>
        <p class="mb-3 text-center text-xs text-white/55">
          Next player must follow it
        </p>
        <div class="grid grid-cols-4 gap-2">
          {SUIT_BUTTONS.map(({ suit, glyph, red }) => (
            <button
              key={suit}
              type="button"
              onClick={() => onPick(suit)}
              class={`rounded-xl border border-kadi-cream-line bg-kadi-cream py-3 text-3xl font-bold shadow-sm transition hover:brightness-105 active:scale-95 ${red ? "text-[#b3261e]" : "text-kadi-ink"}`}
            >
              {glyph}
              <span class="block text-[10px] uppercase tracking-wide text-current/70">
                {suit}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          class="kadi-ghost-button mt-3 w-full rounded-xl py-2 text-sm font-bold"
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
      <div class="kadi-panel-strong whitespace-nowrap rounded-full border-kadi-gold/40 px-4 py-2 text-sm font-semibold text-kadi-gold shadow-xl">
        {message}
      </div>
    </div>
  );
}

const COACH_STYLE: Record<CoachTone, string> = {
  action: "border-kadi-gold/60 bg-kadi-gold/10 text-kadi-gold-bright",
  ok: "border-emerald-400/55 bg-emerald-400/10 text-emerald-100",
  bad: "border-red-400/60 bg-red-500/15 text-red-100",
  wait: "border-kadi-line/45 bg-kadi-deep/45 text-white/70",
  win: "border-kadi-gold bg-kadi-gold/15 text-kadi-gold",
};

/** Contextual turn line, always answers "what do I do now?". */
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
  play: "border-kadi-line/50",
  penalty: "border-red-400/60",
  block: "border-emerald-400/55",
  suit: "border-emerald-400/55",
  demand: "border-kadi-gold/60",
  skip: "border-kadi-gold/45",
  reverse: "border-kadi-gold/45",
  draw: "border-kadi-line/50",
  kadi: "border-kadi-gold",
  win: "border-kadi-gold",
  info: "border-kadi-line/50",
};

const TONE_DOT: Record<FeedTone, string> = {
  play: "bg-white/40",
  penalty: "bg-red-400",
  block: "bg-emerald-400",
  suit: "bg-emerald-400",
  demand: "bg-kadi-gold",
  skip: "bg-kadi-gold/80",
  reverse: "bg-kadi-gold/80",
  draw: "bg-white/30",
  kadi: "bg-kadi-gold",
  win: "bg-kadi-gold",
  info: "bg-white/30",
};

function rowClass(e: FeedEvent): string {
  const involvesYou = e.actor === "You" || e.text.includes("You") || e.text.includes(" you ");
  if (e.actor === "You") return "text-kadi-gold-bright font-semibold";
  if (involvesYou) return "text-amber-100 font-semibold";
  if (e.actor === "Table") return "text-white/55";
  return "text-white/80";
}

function FeedGroups({ groups }: { groups: TurnGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <div key={`${g.turn}-${g.actor}-${g.events[0]?.id ?? "empty"}`}>
          <p class="text-[10px] font-bold uppercase tracking-widest text-white/40">
            {g.actor === "Table" ? "Table" : `Turn ${g.turn} · ${g.actor}`}
          </p>
          <div class="mt-0.5 flex flex-col gap-1">
            {g.events.map((e) => (
              <p
                key={e.id}
                class={`flex items-start gap-1.5 text-[11px] leading-snug break-words ${rowClass(e)}`}
              >
                <span
                  aria-hidden="true"
                  class={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[e.tone]}`}
                />
                <span aria-hidden="true">{e.icon}</span>
                <span>{e.text}</span>
              </p>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Grouped turn-log. The banner variant shows the latest line and expands on
 * tap; the panel variant is permanently expanded for the desktop rail.
 */
export function EventBanner({
  events,
  variant = "banner",
}: {
  events: FeedEvent[];
  variant?: "banner" | "panel";
}) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = events.slice(-15);
  const groups = groupFeed(visible);
  const groupsDesc = [...groups].reverse();
  const latest = visible[visible.length - 1];

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length, open]);

  if (!latest) {
    if (variant === "panel") {
      return (
        <div
          class="rounded-xl border border-kadi-line/45 bg-kadi-deep/40 px-3 py-2 text-center text-xs text-white/40"
          data-testid="feed-panel"
        >
          New match, shuffling…
        </div>
      );
    }
    return (
      <div class="mb-1 -mt-1 px-4">
        <div class="w-full rounded-xl border border-kadi-line/45 bg-kadi-deep/40 px-3 py-1.5 text-center text-xs text-white/40">
          New match, shuffling…
        </div>
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <div
        class="flex h-full min-h-0 flex-col"
        aria-live="polite"
        data-testid="feed-panel"
      >
        <div class="flex items-center justify-between px-1">
          <p class="flex items-center gap-2 kadi-label">
            <Icon name="history" class="h-4 w-4 text-kadi-gold/90" />
            Match log
          </p>
          <span class="text-[10px] font-bold text-white/35">{visible.length}</span>
        </div>
        <div class="no-scrollbar mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain rounded-xl border border-kadi-line/40 bg-kadi-deep/40 px-3 py-2">
          <FeedGroups groups={groupsDesc} />
        </div>
      </div>
    );
  }

  const latestGroup = groups[groups.length - 1];
  const summary = latestGroup && latestGroup.events.length > 0
    ? latestGroup.events[latestGroup.events.length - 1]
    : latest;
  return (
    <div class="mb-1 -mt-1 px-4" aria-live="polite" data-testid="feed-banner">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Collapse recent turns" : "Expand recent turns"}
        class={`w-full rounded-xl border bg-kadi-deep/55 px-3 py-2 text-center transition active:scale-[0.99] ${TONE_BAR[summary.tone]}`}
      >
        <span
          key={summary.id}
          class="anim-fly-in flex items-center justify-center gap-2 text-xs text-white/90"
        >
          <span aria-hidden="true">{summary.icon}</span>
          <span class="flex-1 break-words text-center">{summary.text}</span>
          <span class="flex items-center gap-1 text-[10px] text-white/40">
            {open ? "▲" : <Icon name="history" class="h-3.5 w-3.5" />}
            {!open && visible.length}
          </span>
        </span>
      </button>
      {open && (
        <div
          ref={scrollRef}
          aria-live="polite"
          class="no-scrollbar mt-1 flex max-h-44 flex-col gap-2 overflow-y-auto rounded-xl border border-kadi-line/40 bg-kadi-deep/60 px-3 py-2"
        >
          <FeedGroups groups={groupsDesc} />
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
      class="fixed inset-0 z-50 flex items-end justify-center bg-kadi-deep/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Demand a card"
        class="kadi-panel-strong max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-2xl p-4 md:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p class="text-center font-bold text-kadi-gold">
          ⚡ SUPER ACE! Demand any card
        </p>
        <p class="mt-0.5 mb-1 text-center text-xs text-white/55">
          Step 1: rank {rank ? "✓" : ""} → Step 2: suit
        </p>
        <p class="mb-3 text-center text-[11px] text-kadi-gold/70">
          ★ ranks are in your hand, rivals can&apos;t hold them
        </p>
        <div class="grid grid-cols-7 gap-1.5">
          {REQUEST_RANKS.map((r) => {
            const held = countOf(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRank(r)}
                class={`relative rounded-lg border py-2 text-sm font-black transition active:scale-95 ${
                  rank === r
                    ? "border-kadi-gold bg-kadi-gold text-kadi-ink"
                    : held > 0
                      ? "border-kadi-gold/60 bg-kadi-cream text-kadi-ink ring-2 ring-kadi-gold/40"
                      : "border-transparent bg-kadi-cream/80 text-kadi-ink"
                }`}
              >
                {held > 0 && rank !== r ? "★" : ""}
                {r}
                {held > 1 && (
                  <span class="absolute -right-1 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-kadi-gold px-0.5 text-[9px] font-black text-kadi-ink">
                    ×{held}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div class="mt-3 grid grid-cols-4 gap-2">
          {SUIT_BUTTONS.map(({ suit, glyph, red }) => {
            const heldHere = rank != null && countOf(rank, suit) > 0;
            return (
              <button
                key={suit}
                type="button"
                disabled={!rank}
                onClick={() => rank && onPick(rank, suit)}
                class={`rounded-xl border border-kadi-cream-line bg-kadi-cream py-3 text-3xl font-bold transition active:scale-95 disabled:opacity-30 ${heldHere ? "ring-4 ring-kadi-gold" : ""} ${red ? "text-[#b3261e]" : "text-kadi-ink"}`}
              >
                {glyph}
                <span class="block text-[10px] uppercase tracking-wide text-current/70">
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
          class="kadi-ghost-button mt-3 w-full rounded-xl py-2 text-sm font-bold"
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
      class="fixed inset-0 z-50 flex items-end justify-center bg-kadi-deep/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quit this match?"
        class="kadi-panel-strong anim-fly-in relative max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-3xl p-6 text-center md:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          class="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 active:scale-95"
        >
          <Icon name="x" class="h-4 w-4" />
        </button>
        <span class="mx-auto grid h-14 w-14 place-items-center rounded-full border border-kadi-gold/35 bg-kadi-gold/10 text-kadi-gold">
          <Icon name="pause" class="h-7 w-7" />
        </span>
        <h3 class="mt-2 text-xl font-black text-kadi-gold">Quit this match?</h3>
        <p class="mt-1 text-sm text-white/60">
          Save to continue later from Home or exit and forfeit the match.
        </p>
        <button
          type="button"
          onClick={onSaveExit}
          class="kadi-gold-button mt-5 w-full rounded-2xl py-3.5 font-black active:scale-95"
        >
          Save &amp; exit
        </button>
        <button
          type="button"
          onClick={onExit}
          class="kadi-ghost-button mt-2 w-full rounded-2xl py-3 text-sm font-bold text-red-200 active:scale-95"
        >
          Exit
        </button>
      </div>
    </div>
  );
}

/** Arcade-style 3D buzzer for declaring Kadi, chrome ring, glossy red dome. */
export interface PresetPillProps {
  preset: import("../engine/rules").RulesConfig;
  isActive: boolean;
  onSelect: () => void;
  onCustomize?: () => void;
  showCustomize?: boolean;
}

export function PresetPill({
  preset,
  isActive,
  onSelect,
  onCustomize,
  showCustomize = false,
}: PresetPillProps) {
  const desc = describeRules(preset);
  return (
    <button
      type="button"
      onClick={onSelect}
      class={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition active:scale-[0.99] ${
        isActive
          ? "border-kadi-gold/70 bg-kadi-gold/10"
          : "border-kadi-line/40 bg-kadi-deep/30 hover:bg-white/5"
      }`}
    >
      <span class="shrink-0 text-lg" aria-hidden="true">
        {preset.jokersEnabled ? (preset.penaltyMatchMode === "any" ? "💣" : "🃏") : "🚫"}
      </span>
      <div class="min-w-0 flex-1">
        <span class="block truncate text-sm font-bold text-white">{preset.name}</span>
        <span class="block truncate text-[10px] text-white/55">{desc}</span>
      </div>
      {showCustomize && onCustomize && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCustomize();
          }}
          class="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 active:scale-95"
          aria-label={`Customize ${preset.name}`}
        >
          <Icon name="edit" class="h-3.5 w-3.5" />
        </button>
      )}
    </button>
  );
}

/** Arcade-style 3D buzzer for declaring Kadi, chrome ring, glossy red dome. */
export function KadiBuzzer({
  urgent,
  disabled,
  title,
  onPress,
}: {
  urgent: boolean;
  disabled?: boolean;
  title: string;
  onPress: () => void;
}) {
  const off = disabled === true;
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={off}
      aria-label="Declare Kadi"
      title={title}
      data-testid="kadi-buzzer"
      class={`kadi-buzzer ${urgent && !off ? "kadi-buzzer-urgent" : "kadi-buzzer-idle"}${off ? " kadi-buzzer-disabled" : ""}`}
    >
      <span class="kadi-buzzer-shadow" aria-hidden="true" />
      <span class="kadi-buzzer-base" aria-hidden="true">
        <span class="kadi-buzzer-dome" aria-hidden="true">
          <span class="kadi-buzzer-gloss" aria-hidden="true" />
          <span class="kadi-buzzer-label" aria-hidden="true">
            KADI!
          </span>
        </span>
      </span>
    </button>
  );
}
