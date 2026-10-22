import type { ComponentChildren } from "preact";
import { Icon } from "./icons";
import { PageBackdrop } from "./theme";

export type PageWidth = "md" | "lg" | "xl" | "wide";

const WIDTH: Record<PageWidth, string> = {
  md: "max-w-md md:max-w-2xl",
  lg: "max-w-md md:max-w-3xl lg:max-w-5xl",
  xl: "max-w-md md:max-w-4xl lg:max-w-6xl",
  wide: "max-w-md md:max-w-5xl lg:max-w-7xl",
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
    <div class="kadi-shell relative flex h-dvh flex-col overflow-hidden text-white safe-top safe-bottom">
      <PageBackdrop />
      <div
        class={`relative z-10 mx-auto flex h-full w-full flex-col px-4 pb-4 pt-4 sm:px-6 ${WIDTH[width]}`}
      >
        {children}
      </div>
    </div>
  );
}

/** Shared page title with a 44px back target and optional right-side action. */
export function PageHeader({
  title,
  accent,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  accent?: string;
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
          class="inline-flex min-h-11 min-w-11 items-center justify-start rounded-xl text-white/60 transition-colors hover:text-kadi-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kadi-gold"
        >
          <Icon name="arrowLeft" class="h-5 w-5" />
        </button>
        {right}
      </div>
      <h2 class="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">
        {title}
        {accent && <span class="text-kadi-gold"> {accent}</span>}
      </h2>
      {subtitle && (
        <p class="mt-1 text-xs text-white/55 md:text-sm">{subtitle}</p>
      )}
    </div>
  );
}
