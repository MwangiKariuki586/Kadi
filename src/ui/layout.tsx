import type { ComponentChildren } from "preact";

export type PageWidth = "md" | "lg" | "xl";

const WIDTH: Record<PageWidth, string> = {
  md: "max-w-md md:max-w-2xl",
  lg: "max-w-md md:max-w-3xl lg:max-w-5xl",
  xl: "max-w-md md:max-w-4xl lg:max-w-6xl",
};

/** Full-height app pane with a responsive, centred content column. */
export function ScreenFrame({
  width = "lg",
  children,
}: {
  width?: PageWidth;
  children: ComponentChildren;
}) {
  return (
    <div class="h-dvh overflow-hidden bg-gradient-to-b from-green-950 via-green-900 to-green-950 text-white flex flex-col safe-top safe-bottom">
      <div
        class={`mx-auto flex h-full w-full flex-col px-6 pb-4 pt-4 ${WIDTH[width]}`}
      >
        {children}
      </div>
    </div>
  );
}

/** Shared page title with a 44px back target and optional right-side action. */
export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: ComponentChildren;
}) {
  return (
    <div class="shrink-0">
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          class="inline-flex min-h-11 min-w-11 items-center justify-start rounded-xl text-white/60 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
        >
          <span aria-hidden="true" class="font-black text-2xl">
            ⬅
          </span>
        </button>
        {right}
      </div>
      <h2 class="mt-1 text-3xl font-black text-yellow-300 md:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p class="mt-0.5 text-xs text-white/60 md:text-sm">{subtitle}</p>
      )}
    </div>
  );
}

export type SeatSlot = "left" | "top" | "right";

const SLOTS: Record<number, SeatSlot[]> = {
  1: ["top"],
  2: ["left", "right"],
  3: ["left", "top", "right"],
};

/**
 * Visual seat for a bot. Seat 1 is the clockwise neighbour (left), then the
 * top seat, then the right seat. Reversing direction changes turn order only;
 * physical seats never move.
 */
export function seatPlacement(botIndex: number, botCount: number): SeatSlot {
  const safeCount = Math.min(Math.max(botCount, 1), 3);
  const slots = SLOTS[safeCount] ?? SLOTS[3];
  const safeIndex = Math.min(Math.max(botIndex, 0), slots.length - 1);
  return slots[safeIndex];
}

export const SEAT_SLOT_CLASS: Record<SeatSlot, string> = {
  left: "lg:col-start-1 lg:row-start-2 lg:self-center",
  top: "lg:col-start-2 lg:row-start-1 lg:justify-self-center",
  right: "lg:col-start-3 lg:row-start-2 lg:self-center",
};
