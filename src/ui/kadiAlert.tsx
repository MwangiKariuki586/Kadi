import { Avatar } from "./theme";

/**
 * Large, non-blocking claim announcement for an opponent or the human.
 * Sits below the topbar and above the felt so it never covers the player's
 * hand, and ignores pointer events so the table stays playable while it is
 * visible. Auto-dismisses after 3s; the flashing seat card remains as a
 * persistent backup for anyone who missed the toast.
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
            {name.toUpperCase()} ako KADI!
          </p>
          <p class="text-xs font-semibold text-white/75 sm:text-sm">
            stop them!
          </p>
        </div>
        <span aria-hidden="true" class="ml-auto shrink-0 text-2xl sm:text-3xl">
          📢
        </span>
      </div>
    </div>
  );
}
