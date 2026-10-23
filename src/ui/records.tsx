import { relativeTime, type MatchRecord } from "../store/history";
import { Icon } from "./icons";
import { PageHeader, ScreenFrame } from "./layout";
import { Avatar, EmptyState, Panel } from "./theme";

function opponents(match: MatchRecord): string[] {
  return match.playerNames.filter((name) => name !== "You");
}

export function MyGamesScreen({
  history,
  onBack,
  onPlay,
}: {
  history: MatchRecord[];
  onBack: () => void;
  onPlay: () => void;
}) {
  return (
    <ScreenFrame width="lg">
      <PageHeader
        title="My"
        accent="Games"
        subtitle="Every table you have finished on this device."
        onBack={onBack}
      />
      <div class="no-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        {history.length === 0 ? (
          <EmptyState
            icon="history"
            title="No finished games yet"
            copy="Your results, opponents and table rules will be saved here automatically."
            action={
              <button
                type="button"
                onClick={onPlay}
                class="kadi-gold-button rounded-xl px-4 py-2 text-xs font-black"
              >
                Deal me in
              </button>
            }
          />
        ) : (
          <div class="flex flex-col gap-2">
            {history.map((match) => {
              const won = match.winnerIndex === 0;
              const rivals = opponents(match);
              return (
                <Panel class="p-3.5" key={match.id}>
                  <div class="flex items-start gap-3">
                    <span
                      class={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border ${
                        won
                          ? "border-kadi-gold/50 bg-kadi-gold/10 text-kadi-gold"
                          : "border-white/10 bg-white/5 text-white/45"
                      }`}
                    >
                      <Icon name={won ? "trophy" : "deck"} class="h-5 w-5" />
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black text-white/65">
                          {match.playerNames.length}P
                        </span>
                        <span
                          class={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            won
                              ? "bg-emerald-400/15 text-emerald-300"
                              : "bg-red-400/15 text-red-300"
                          }`}
                        >
                          {won ? "Won" : "Lost"}
                        </span>
                        <span class="text-[10px] text-white/35">
                          {relativeTime(match.at)}
                        </span>
                      </div>
                      <p class="mt-1.5 truncate text-sm font-bold text-white/85">
                        {won ? "You won the table" : `${match.playerNames[match.winnerIndex]} won the table`}
                      </p>
                      <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/40">
                        <span class="flex items-center gap-1">
                          <Icon name="users" class="h-3 w-3" />
                          {rivals.join(", ")}
                        </span>
                        <span>{match.presetName}</span>
                        <span class="capitalize">{match.difficulty}</span>
                        <span>{match.turns} turns</span>
                      </div>
                    </div>
                    <div class="hidden shrink-0 items-center gap-1 sm:flex">
                      {match.playerNames.map((name) => (
                        <Avatar
                          key={`${match.id}-${name}`}
                          name={name}
                          size="sm"
                          highlight={name === "You"}
                        />
                      ))}
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </ScreenFrame>
  );
}
