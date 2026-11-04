import { Avatar } from "./theme";

/**
 * Large, non-blocking claim announcement for an opponent. Deliberately sits
 * below the topbar and above the felt so it never covers the player's hand,
 * and ignores pointer events so the table stays playable while it is visible.
 * The human's own claim never raises this banner — the buzzer and feed already
 * carry that status.
 */
export function KadiAlert({ name }: { name: string }) {
  return (
    <div
      class="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-4"
      role="alert"
      aria-live="assertive"
    >
      <div
        data-testid="kadi-alert"
        class="anim-fanfare flex w-full max-w-md items-center gap-3 rounded-2xl border-2 border-red-400/80 bg-red-950/95 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:gap-4 sm:px-5 sm:py-4"
      >
        <Avatar name={name} size="lg" />
        <div class="min-w-0">
          <p class="text-lg font-black leading-tight text-red-200 sm:text-2xl">
            {name.toUpperCase()} IS KADI!
          </p>
          <p class="text-xs font-semibold text-white/75 sm:text-sm">
            Called KADI — stop them for a full round!
          </p>
        </div>
        <span aria-hidden="true" class="ml-auto shrink-0 text-2xl sm:text-3xl">
          📢
        </span>
      </div>
    </div>
  );
}

/**
 * Center-stage KADI warning for an opponent. Persists for as long as an
 * opponent has called KADI so it is impossible to miss — especially right
 * after the human's turn, when the KADI opponent is about to play.
 * pointer-events-none keeps the table fully playable while it is visible.
 */
export function KadiCenterAlert({ name }: { name: string }) {
  return (
    <div
      class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4"
      role="alert"
      aria-live="assertive"
    >
      <div
        data-testid="kadi-center-alert"
        class="anim-fanfare anim-kadi-pulse flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border-2 border-red-500/90 bg-red-900/95 px-5 py-4 shadow-[0_20px_60px_rgba(217,45,45,0.7)] backdrop-blur-md sm:flex-row sm:gap-5 sm:px-7 sm:py-5"
      >
        <Avatar name={name} size="lg" />
        <div class="text-center min-w-0 sm:text-left">
          <p class="font-black leading-tight text-red-100 sm:text-xl">
            {name.toUpperCase()} IS KADI!
          </p>
          <p class="text-xs font-semibold text-white/80 sm:text-sm">
            Stop them for a full round
          </p>
        </div>
        <span aria-hidden="true" class="text-3xl sm:text-4xl">📢</span>
      </div>
    </div>
  );
}
