import { useEffect, useRef } from "preact/hooks";
import type { ActiveGameSave, Stats } from "../store/local";
import { relativeTime, type MatchRecord } from "../store/history";
import { Icon } from "./icons";
import { InstallButton, InstallCard } from "./installPrompt";
import { useDialogFocus } from "./dialogFocus";
import {
  BrandMark,
  HeroCardFan,
  PageBackdrop,
  Panel,
  SectionLabel,
  StatsCard,
  winRate,
} from "./theme";

const MODES: { bots: number; label: string; sub: string }[] = [
  { bots: 1, label: "2P", sub: "Play vs 1 bot" },
  { bots: 2, label: "3P", sub: "Play vs 2 bots" },
  { bots: 3, label: "4P", sub: "Play vs 3 bots" },
];

function resultOf(match: MatchRecord): boolean {
  return match.winnerIndex === 0;
}

function opponentLine(match: MatchRecord): string {
  const names = match.playerNames.filter((n) => n !== "You");
  return names.length > 0 ? `vs ${names.join(", ")}` : "Solo table";
}

function RecentGamesCard({
  matches,
  onViewAll,
  fill = false,
}: {
  matches: MatchRecord[];
  onViewAll: () => void;
  fill?: boolean;
}) {
  return (
    <Panel class={`p-4 ${fill ? "flex min-h-0 flex-1 flex-col" : ""}`}>
      <SectionLabel
        icon="history"
        right={
          <button
            type="button"
            onClick={onViewAll}
            class="flex items-center gap-1 text-[10px] font-bold text-white/45 transition hover:text-kadi-gold"
          >
            View all
            <Icon name="arrowRight" class="h-3 w-3" />
          </button>
        }
      >
        Recent games
      </SectionLabel>
      {matches.length === 0 ? (
        <div class={`${fill ? "flex flex-1 items-center" : ""}`}>
          <p class="mt-2 w-full rounded-lg border border-dashed border-kadi-line/50 px-2 py-3 text-center text-[10px] text-white/45">
            Finish a match and it will show up here.
          </p>
        </div>
      ) : (
        <div
          class={`mt-2 flex flex-col gap-0.5 ${
            fill ? "min-h-0 flex-1 overflow-y-auto no-scrollbar" : ""
          }`}
        >
          {matches.map((match) => {
            const won = resultOf(match);
            return (
              <div
                key={match.id}
                class="flex items-center gap-2 rounded-lg px-1.5 py-1.5"
              >
                <span
                  class={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
                    won
                      ? "border-kadi-gold/40 bg-kadi-gold/10 text-kadi-gold"
                      : "border-white/10 bg-white/5 text-white/40"
                  }`}
                >
                  <Icon name={won ? "trophy" : "deck"} class="h-4 w-4" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-xs font-bold text-white/80">
                    {opponentLine(match)}
                  </span>
                  <span class="block truncate text-[10px] text-white/35">
                    {match.presetName} · {relativeTime(match.at)}
                  </span>
                </span>
                <span
                  class={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                    won
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-red-400/15 text-red-300"
                  }`}
                >
                  {won ? "Won" : "Lost"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function ChallengeCard({ onCreateRoom }: { onCreateRoom: () => void }) {
  return (
    <Panel strong class="relative w-full overflow-hidden p-4">
      <div class="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-kadi-gold/10 blur-xl" />
      <span class="grid h-10 w-10 place-items-center rounded-full border border-kadi-gold/40 bg-kadi-gold/10 text-kadi-gold">
        <Icon name="crown" class="h-5 w-5" />
      </span>
      <h3 class="mt-2 text-sm font-black text-white">
        Challenge your friends!
      </h3>
      <p class="mt-1 text-[11px] leading-relaxed text-white/55">
        Create a private room and invite your friends to play.
      </p>
      <button
        type="button"
        onClick={onCreateRoom}
        class="kadi-ghost-button mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black"
      >
        <Icon name="users" class="h-4 w-4" />
        Create Room
      </button>
    </Panel>
  );
}

export function ChallengeFriendsModal({
  onClose,
  onPlay,
}: {
  onClose: () => void;
  onPlay: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeRef);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-kadi-deep/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-title"
        class="kadi-panel-strong anim-fly-in relative w-full max-w-sm rounded-3xl p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          class="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 active:scale-95"
        >
          <Icon name="x" class="h-4 w-4" />
        </button>
        <span class="mx-auto grid h-14 w-14 place-items-center rounded-full border border-kadi-gold/40 bg-kadi-gold/10 text-kadi-gold">
          <Icon name="crown" class="h-7 w-7" />
        </span>
        <h3 id="challenge-title" class="mt-3 text-xl font-black text-white">
          Private rooms are coming
        </h3>
        <p class="mt-1 text-sm leading-relaxed text-white/60">
          Kadi v1 plays offline against smart bots. Online rooms and friend
          invites arrive with v2.
        </p>
        <button
          type="button"
          onClick={onPlay}
          class="kadi-gold-button mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-black"
        >
          <Icon name="play" class="h-4 w-4" />
          Test yourself
        </button>
      </div>
    </div>
  );
}

export interface HomeScreenProps {
  stats: Stats;
  history: MatchRecord[];
  numBots: number;
  resumable: ActiveGameSave | null;
  onPlay: () => void;
  onSelectMode: (bots: number) => void;
  onContinue: () => void;
  onHowTo: () => void;
  onSettings: () => void;
  onViewGames: () => void;
  onCreateRoom: () => void;
}

export function HomeScreen({
  stats,
  history,
  numBots,
  resumable,
  onPlay,
  onSelectMode,
  onContinue,
  onHowTo,
  onSettings,
  onViewGames,
  onCreateRoom,
}: HomeScreenProps) {
  const recent = history.slice(0, 4);

  return (
    <div class="kadi-shell relative min-h-dvh overflow-x-hidden text-white safe-top safe-bottom">
      <PageBackdrop hero />
      <div class="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1500px] flex-col px-4 pb-0 sm:px-6 xl:px-10">
        <header class="flex items-center justify-between gap-3 py-4">
          <BrandMark />
          <div class="flex items-center gap-2">
            <InstallButton />
            <button
              type="button"
              aria-label="Open settings"
              onClick={onSettings}
              class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-kadi-line/45 bg-kadi-deep/30 text-white/65 transition hover:border-kadi-gold/40 hover:text-kadi-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kadi-gold"
            >
              <Icon name="settings" class="h-5 w-5" />
            </button>
          </div>
        </header>

        <div class="grid auto-rows-fr flex-1 grid-cols-1 gap-6 pb-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <main class="flex min-w-0 flex-col">
            <section class="relative grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] xl:gap-8">
              <div class="relative z-10">
                <p class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">
                  <span class="h-px w-7 bg-kadi-gold" aria-hidden="true" />
                  Welcome back
                </p>
                <h1 class="mt-2 text-6xl font-black tracking-[-0.04em] text-kadi-gold md:text-7xl xl:text-[6.5rem] xl:leading-[0.88]">
                  KADI
                </h1>
                <p class="mt-1 text-lg font-bold text-white/90 md:text-xl">
                  Kenyan card game <span class="text-kadi-gold">•</span> plays
                  offline
                </p>
                <p class="mt-2 max-w-md text-sm leading-relaxed text-white/55">
                  Play against smart bots, track your progress and become a Kadi
                  champion.
                </p>

                <div class="mt-5 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <button
                    type="button"
                    onClick={onPlay}
                    class="kadi-gold-button flex min-h-12 items-center justify-center gap-2 rounded-2xl px-7 py-3 text-base font-black sm:min-w-44"
                  >
                    <Icon name="play" class="h-5 w-5" />
                    Play Now
                  </button>
                  <button
                    type="button"
                    onClick={onHowTo}
                    class="kadi-ghost-button flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold"
                  >
                    <Icon name="book" class="h-4 w-4" />
                    How to play
                  </button>
                </div>

                {resumable && (
                  <button
                    type="button"
                    onClick={onContinue}
                    class="mt-2 flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-kadi-gold/35 bg-kadi-gold/8 px-4 py-3 text-left transition hover:bg-kadi-gold/12 active:scale-[0.99]"
                  >
                    <span class="min-w-0">
                      <span class="block text-[10px] font-black uppercase tracking-widest text-kadi-gold/80">
                        Saved match
                      </span>
                      <span class="block truncate text-xs font-bold text-white/75">
                        {resumable.state.hands.length} players •{" "}
                        {resumable.state.currentPlayer === 0
                          ? "your turn"
                          : "bot turn"}{" "}
                        • {resumable.state.hands[0].length} cards
                      </span>
                    </span>
                    <span class="flex shrink-0 items-center gap-1 text-xs font-black text-kadi-gold">
                      Continue
                      <Icon name="arrowRight" class="h-4 w-4" />
                    </span>
                  </button>
                )}

                <div class="mt-4 flex flex-wrap gap-2 lg:hidden">
                  <span class="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/70">
                    <Icon name="users" class="h-3.5 w-3.5 text-white/45" />
                    {stats.games} games
                  </span>
                  <span class="inline-flex items-center gap-1.5 rounded-full border border-kadi-gold/35 bg-kadi-gold/10 px-3 py-1.5 text-[11px] font-bold text-kadi-gold">
                    <Icon name="trophy" class="h-3.5 w-3.5" />
                    {stats.wins} wins
                  </span>
                  <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-bold text-emerald-200">
                    <Icon name="flame" class="h-3.5 w-3.5" />
                    Win rate {winRate(stats)}%
                  </span>
                </div>
              </div>

              <div class="pointer-events-none hidden select-none lg:block">
                <HeroCardFan class="h-auto w-full max-w-[560px]" />
              </div>
            </section>

            <section
              class="mt-8 hidden lg:block"
              aria-labelledby="game-mode-title"
            >
              <SectionLabel
                icon="target"
                right={
                  <span class="text-[10px] font-bold uppercase tracking-widest text-white/30">
                    vs bots
                  </span>
                }
              >
                <span id="game-mode-title">Choose a game mode</span>
              </SectionLabel>
              <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {MODES.map((mode) => {
                  const active = numBots === mode.bots;
                  return (
                    <button
                      key={mode.bots}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelectMode(mode.bots)}
                      class={`group relative flex items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                        active
                          ? "border-kadi-gold/80 bg-kadi-gold/10 shadow-[0_0_26px_rgba(245,197,24,0.1)]"
                          : "border-kadi-line/45 bg-kadi-deep/30 hover:border-kadi-gold/40 hover:bg-white/5"
                      }`}
                    >
                      <span
                        class={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${
                          active
                            ? "border-kadi-gold/60 bg-kadi-gold/15 text-kadi-gold"
                            : "border-white/10 bg-white/5 text-white/60"
                        }`}
                      >
                        <Icon name="users" class="h-5 w-5" />
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block text-lg font-black text-white">
                          {mode.label}
                        </span>
                        <span class="block text-[11px] text-white/50">
                          {mode.sub}
                        </span>
                        <span class="mt-0.5 block text-[10px] font-bold text-white/35">
                          You + {mode.bots} 🤖
                        </span>
                      </span>
                      <span
                        class={`grid h-7 w-7 place-items-center rounded-full border transition ${
                          active
                            ? "border-kadi-gold bg-kadi-gold text-kadi-ink"
                            : "border-white/10 text-white/35 group-hover:border-kadi-gold/40 group-hover:text-kadi-gold"
                        }`}
                      >
                        {active ? (
                          <Icon
                            name="check"
                            class="h-4 w-4"
                            strokeWidth={2.4}
                          />
                        ) : (
                          <Icon name="chevronRight" class="h-4 w-4" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div class="mt-6 flex flex-1 flex-col gap-4 lg:hidden">
              <RecentGamesCard matches={history} onViewAll={onViewGames} fill />
              <div class="shrink-0">
                <ChallengeCard onCreateRoom={onCreateRoom} />
              </div>
              <div class="shrink-0">
                <InstallCard games={stats.games} placement="mobile" />
              </div>
            </div>

            <div class="mt-8 hidden lg:block">
              <InstallCard games={stats.games} placement="desktop" />
            </div>
          </main>

          <aside class="hidden min-w-0 flex-col gap-4 lg:flex lg:sticky lg:top-6">
            <StatsCard stats={stats} />
            <RecentGamesCard matches={recent} onViewAll={onViewGames} />
            <ChallengeCard onCreateRoom={onCreateRoom} />
          </aside>
        </div>

        <footer class="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-white/8 py-4 text-[10px] text-white/30">
          <span class="flex items-center gap-2">
            <BrandMark compact />
            <span class="font-bold">KADI</span>
            <span class="text-white/20">v1.0</span>
          </span>
          <span class="italic text-white/35">
            Same game. Different stories.
          </span>
        </footer>
      </div>
    </div>
  );
}
