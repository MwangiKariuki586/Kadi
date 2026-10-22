import type { ComponentChildren } from "preact";
import type { Stats } from "../store/local";
import { Icon, type IconName } from "./icons";

export function BrandMark({
  compact = false,
  class: className = "",
}: {
  compact?: boolean;
  class?: string;
}) {
  return (
    <span class={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      <span class="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-kadi-gold/70 bg-kadi-cream shadow-[0_6px_16px_rgba(0,0,0,0.35)]">
        <span class="font-black text-xl leading-none text-kadi-ink">K</span>
        <span class="absolute -bottom-1 right-1 rounded bg-kadi-gold px-1 text-[8px] font-black leading-3 text-kadi-ink">
          ♠
        </span>
      </span>
      {!compact && (
        <span class="truncate text-xl font-black tracking-[0.14em] text-kadi-gold">
          KADI
        </span>
      )}
    </span>
  );
}

export function ChevronBand({ class: className = "" }: { class?: string }) {
  return (
    <div
      aria-hidden="true"
      class={`kadi-chevron h-2 opacity-60 ${className}`}
    />
  );
}

/** Shared atmospheric backdrop: glow, landscape silhouette and trim. */
export function PageBackdrop({ hero = false }: { hero?: boolean }) {
  return (
    <div
      class="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div class="absolute inset-0 bg-[radial-gradient(900px_500px_at_78%_-8%,rgba(245,197,24,0.08),transparent_60%)]" />
      <div
        class={`absolute bottom-0 left-0 right-0 ${
          hero ? "h-[28rem] opacity-60" : "h-64 opacity-35"
        }`}
      >
        <svg
          viewBox="0 0 1440 420"
          preserveAspectRatio="xMidYMax slice"
          class="h-full w-full"
        >
          <defs>
            <linearGradient id="kadi-landscape" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#0a3b28" stop-opacity="0.55" />
              <stop offset="100%" stop-color="#02140d" stop-opacity="0.95" />
            </linearGradient>
          </defs>
          <path
            d="M0 316c143-36 220-18 330 4 91 18 147 5 238-25 143-47 251-33 372 8 101 34 208 22 300 5 74-14 138-10 200 2v110H0V316Z"
            fill="url(#kadi-landscape)"
          />
          <g fill="#031b12" opacity="0.78">
            <path d="M118 330c12-38 8-83 4-126-2-20 22-24 26-4 7 35 1 83 12 130h-42Z" />
            <path d="M67 214c26-19 54-20 82-6 18 9 34 8 55 1-15 16-37 24-55 18 22 6 35 19 41 32-25-8-45-10-64-3 16 13 22 27 23 41-21-20-46-23-64-38-13-11-27-23-18-45Z" />
            <path d="M151 188c20-14 44-13 61 1 13 11 24 14 40 12-13 11-29 14-43 8 14 8 21 18 24 30-17-8-32-10-46-5 9 9 13 19 14 29-15-14-32-17-44-28-9-8-17-16-12-29 3-9 8-14 6-18Z" />
            <path d="M1240 334c9-34 5-69 2-101-1-15 18-18 22-3 6 29 1 67 10 104h-34Z" />
            <path d="M1192 227c22-16 45-17 67-5 15 8 28 7 45 1-12 13-30 20-45 15 18 5 29 16 34 27-21-6-37-8-53-2 13 10 18 22 19 33-17-16-38-18-52-31-11-9-22-19-15-38Z" />
          </g>
        </svg>
      </div>
      <ChevronBand class="absolute inset-x-0 top-0 opacity-30" />
    </div>
  );
}

export function Panel({
  children,
  class: className = "",
  strong = false,
}: {
  children: ComponentChildren;
  class?: string;
  strong?: boolean;
}) {
  return (
    <section
      class={`${strong ? "kadi-panel-strong" : "kadi-panel"} rounded-2xl ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionLabel({
  icon,
  children,
  right,
  class: className = "",
}: {
  icon?: IconName;
  children: ComponentChildren;
  right?: ComponentChildren;
  class?: string;
}) {
  return (
    <div class={`flex items-center justify-between gap-3 ${className}`}>
      <p class="flex min-w-0 items-center gap-2 kadi-label">
        {icon && <Icon name={icon} class="h-4 w-4 text-kadi-gold/90" />}
        <span class="truncate">{children}</span>
      </p>
      {right}
    </div>
  );
}

export function winRate(stats: Stats): number {
  if (stats.games <= 0) return 0;
  return Math.round((stats.wins / stats.games) * 100);
}

export function StatsCard({
  stats,
  class: className = "",
  title = "Your Stats",
}: {
  stats: Stats;
  class?: string;
  title?: string;
}) {
  return (
    <Panel class={`p-4 ${className}`}>
      <SectionLabel
        icon="chart"
        right={
          <span class="text-[10px] font-bold uppercase tracking-widest text-kadi-gold/70">
            local
          </span>
        }
      >
        {title}
      </SectionLabel>
      <div class="mt-3 grid grid-cols-3 divide-x divide-white/10 text-center">
        <div class="px-1">
          <p class="text-2xl font-black text-white">{stats.games}</p>
          <p class="text-[10px] font-semibold uppercase tracking-widest text-white/45">
            Games
          </p>
        </div>
        <div class="px-1">
          <p class="text-2xl font-black text-kadi-gold">{stats.wins}</p>
          <p class="text-[10px] font-semibold uppercase tracking-widest text-white/45">
            Wins
          </p>
        </div>
        <div class="px-1">
          <p class="text-2xl font-black text-white">{winRate(stats)}%</p>
          <p class="text-[10px] font-semibold uppercase tracking-widest text-white/45">
            Win Rate
          </p>
        </div>
      </div>
      <div class="mt-3 flex items-center justify-between rounded-xl border border-kadi-line/45 bg-kadi-deep/35 px-3 py-2">
        <span class="flex items-center gap-2 text-xs font-bold text-white/70">
          <Icon name="star" class="h-4 w-4 text-kadi-gold" />
          Best Streak
        </span>
        <span class="text-sm font-black text-kadi-gold">
          {stats.bestStreak}
        </span>
      </div>
    </Panel>
  );
}

const AVATARS: Record<string, string> = {
  You: "Y",
  Jabari: "🦁",
  Amani: "🕊️",
  Zawadi: "🎁",
  Neema: "🌟",
};

export function avatarFor(name: string): string {
  return AVATARS[name] ?? name.slice(0, 1).toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  highlight = false,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  highlight?: boolean;
}) {
  const dims =
    size === "sm"
      ? "h-7 w-7 text-xs"
      : size === "lg"
        ? "h-11 w-11 text-lg"
        : "h-9 w-9 text-sm md:h-10 md:w-10";
  return (
    <span
      class={`grid shrink-0 place-items-center rounded-full border font-black ${dims} ${
        highlight
          ? "border-kadi-gold/80 bg-kadi-gold/15 text-kadi-gold"
          : "border-white/15 bg-white/10 text-white/85"
      }`}
      aria-hidden="true"
    >
      {avatarFor(name)}
    </span>
  );
}

export function EmptyState({
  icon = "deck",
  title,
  copy,
  action,
  class: className = "",
}: {
  icon?: IconName;
  title: string;
  copy: string;
  action?: ComponentChildren;
  class?: string;
}) {
  return (
    <div
      class={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-kadi-line/60 bg-kadi-deep/25 px-5 py-7 text-center ${className}`}
    >
      <span class="grid h-11 w-11 place-items-center rounded-full border border-kadi-gold/30 bg-kadi-gold/10 text-kadi-gold">
        <Icon name={icon} class="h-5 w-5" />
      </span>
      <p class="mt-2 text-sm font-black text-white">{title}</p>
      <p class="mt-1 max-w-xs text-[11px] leading-relaxed text-white/55">
        {copy}
      </p>
      {action && <div class="mt-3">{action}</div>}
    </div>
  );
}

/** Decorative hero art: fanned court cards over a painted savannah sweep. */
export function HeroCardFan({ class: className = "" }: { class?: string }) {
  return (
    <svg
      viewBox="0 0 620 470"
      class={className}
      role="img"
      aria-label="Fanned Kadi cards over a painted savannah"
    >
      <defs>
        <linearGradient id="hero-brush" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2b8f58" stop-opacity="0.9" />
          <stop offset="55%" stop-color="#146b40" stop-opacity="0.92" />
          <stop offset="100%" stop-color="#0a3d27" stop-opacity="0.95" />
        </linearGradient>
        <linearGradient id="hero-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffe066" />
          <stop offset="100%" stop-color="#e0aa05" />
        </linearGradient>
        <linearGradient id="hero-card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fffaf0" />
          <stop offset="100%" stop-color="#eee2c4" />
        </linearGradient>
        <filter id="hero-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="0"
            dy="14"
            stdDeviation="12"
            flood-color="#00140c"
            flood-opacity="0.55"
          />
        </filter>
      </defs>

      <circle cx="338" cy="218" r="200" fill="#0a3a26" opacity="0.5" />
      <circle
        cx="338"
        cy="218"
        r="152"
        fill="none"
        stroke="#f5c518"
        stroke-opacity="0.12"
        stroke-width="2"
      />

      <g opacity="0.9">
        <path
          d="M46 310c86-95 205-128 304-87 78 32 140 21 212-39-26 102-116 156-206 143-90-13-148 19-212 72-49 41-86 37-98 16-9-17 0-36-2-53-3-19-9-35 2-52Z"
          fill="url(#hero-brush)"
        />
        <path
          d="M114 356c78-51 140-58 214-27 88 37 166 19 233-42-16 67-72 108-141 108-80 0-124 8-198 47-50 26-95 29-108 4-7-14 0-34 0-54 0-13-6-24 0-36Z"
          fill="#0d5536"
          opacity="0.75"
        />
        <path
          d="M82 262c105-62 199-71 285-31 74 34 145 22 209-25"
          fill="none"
          stroke="#f5c518"
          stroke-opacity="0.45"
          stroke-width="10"
          stroke-linecap="round"
        />
        <path
          d="M158 318c86-33 164-28 233 12 49 28 103 26 156-3"
          fill="none"
          stroke="#ffe066"
          stroke-opacity="0.18"
          stroke-width="26"
          stroke-linecap="round"
        />
      </g>

      <g fill="#021b11" opacity="0.65">
        <path d="M500 330c10-53 6-106 2-157-2-24 22-27 26-4 6 44 1 107 12 166h-48Z" />
        <path d="M427 190c35-25 74-27 111-8 23 12 47 10 72-2-19 22-49 32-74 24 30 8 47 26 55 44-34-11-60-13-87-4 22 17 29 37 31 56-28-27-62-31-87-51-17-14-36-31-21-59Z" />
      </g>

      <g transform="rotate(-20 230 250)" filter="url(#hero-shadow)">
        <rect
          x="142"
          y="132"
          width="166"
          height="238"
          rx="14"
          fill="url(#hero-card)"
          stroke="#f5c518"
          stroke-width="3"
        />
        <rect
          x="151"
          y="141"
          width="148"
          height="220"
          rx="9"
          fill="none"
          stroke="#d8c79a"
          stroke-width="1"
        />
        <text
          x="170"
          y="182"
          font-family="system-ui, sans-serif"
          font-size="40"
          font-weight="900"
          fill="#14251b"
        >
          A
        </text>
        <text
          x="222"
          y="215"
          font-family="Georgia, serif"
          font-size="54"
          fill="#14251b"
        >
          ♠
        </text>
        <text
          x="228"
          y="335"
          font-family="Georgia, serif"
          font-size="92"
          text-anchor="middle"
          fill="#14251b"
        >
          ♠
        </text>
        <text
          x="274"
          y="356"
          font-family="system-ui, sans-serif"
          font-size="28"
          font-weight="900"
          fill="#14251b"
        >
          A
        </text>
      </g>

      <g transform="rotate(-4 320 210)" filter="url(#hero-shadow)">
        <rect
          x="253"
          y="96"
          width="174"
          height="250"
          rx="15"
          fill="url(#hero-card)"
          stroke="#f5c518"
          stroke-width="3"
        />
        <rect
          x="262"
          y="105"
          width="156"
          height="232"
          rx="10"
          fill="none"
          stroke="#d8c79a"
          stroke-width="1"
        />
        <text
          x="279"
          y="148"
          font-family="system-ui, sans-serif"
          font-size="42"
          font-weight="900"
          fill="#14251b"
        >
          K
        </text>
        <text
          x="333"
          y="181"
          font-family="Georgia, serif"
          font-size="52"
          fill="#14251b"
        >
          ♠
        </text>
        <path
          d="M302 209h22l5-12 7 15 8-12 6 12h22l-4 9h-62l-4-12Z"
          fill="#c99700"
        />
        <text
          x="340"
          y="323"
          font-family="Georgia, serif"
          font-size="96"
          text-anchor="middle"
          fill="#14251b"
        >
          ♠
        </text>
        <text
          x="386"
          y="338"
          font-family="system-ui, sans-serif"
          font-size="28"
          font-weight="900"
          fill="#14251b"
        >
          K
        </text>
      </g>

      <g transform="rotate(15 405 262)" filter="url(#hero-shadow)">
        <rect
          x="346"
          y="146"
          width="162"
          height="232"
          rx="14"
          fill="url(#hero-card)"
          stroke="#f5c518"
          stroke-width="3"
        />
        <rect
          x="355"
          y="155"
          width="144"
          height="214"
          rx="9"
          fill="none"
          stroke="#d8c79a"
          stroke-width="1"
        />
        <text
          x="374"
          y="196"
          font-family="system-ui, sans-serif"
          font-size="40"
          font-weight="900"
          fill="#b3261e"
        >
          7
        </text>
        <text
          x="424"
          y="229"
          font-family="Georgia, serif"
          font-size="50"
          fill="#b3261e"
        >
          ♣
        </text>
        <text
          x="427"
          y="334"
          font-family="Georgia, serif"
          font-size="88"
          text-anchor="middle"
          fill="#b3261e"
        >
          ♣
        </text>
        <text
          x="469"
          y="356"
          font-family="system-ui, sans-serif"
          font-size="28"
          font-weight="900"
          fill="#b3261e"
        >
          7
        </text>
      </g>

      <g transform="rotate(-8 508 382)">
        <text
          x="508"
          y="382"
          text-anchor="middle"
          font-family="Georgia, serif"
          font-size="34"
          font-style="italic"
          fill="url(#hero-gold)"
        >
          Kula Kadi!
        </text>
        <path
          d="M420 396c52-8 105-8 158 0"
          fill="none"
          stroke="#f5c518"
          stroke-opacity="0.5"
          stroke-width="2"
          stroke-linecap="round"
        />
      </g>

      <g fill="#f5c518" opacity="0.7">
        <circle cx="120" cy="206" r="3" />
        <circle cx="555" cy="196" r="2.5" />
        <circle cx="482" cy="455" r="2" />
        <circle cx="196" cy="432" r="2.5" />
      </g>
    </svg>
  );
}
