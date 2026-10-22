import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { Difficulty } from "../bots/bot";
import type { Settings, Stats } from "../store/local";
import { Pill } from "./components";
import { PageHeader, ScreenFrame } from "./layout";

export interface SettingsScreenProps {
  origin: "home" | "game";
  settings: Settings;
  stats: Stats;
  hasSave: boolean;
  isCustom: boolean;
  onNewCustom: () => void;
  onEditCustom: () => void;
  onBack: () => void;
  onSave: (patch: Partial<Settings>) => void;
  onResetStats: () => void;
  onClearSave: () => void;
  onClearCustoms: () => void;
  onClearHistory: () => void;
}

export function Section({
  level,
  title,
  sub,
  children,
}: {
  level: string;
  title: string;
  sub: string;
  children: ComponentChildren;
}) {
  return (
    <section class="mt-5">
      <div class="flex items-center gap-2">
        <Pill tone="amber">{level}</Pill>
        <h3 class="text-sm font-black text-white">{title}</h3>
      </div>
      <p class="mt-1 text-[11px] text-white/45">{sub}</p>
      <div class="mt-2 flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function ToggleRow({
  icon,
  title,
  sub,
  on,
  onPress,
  badge,
}: {
  icon: string;
  title: string;
  sub: string;
  on: boolean;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPress}
      class={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
        on
          ? "border-kadi-gold/60 bg-kadi-gold/10 hover:border-kadi-gold"
          : "border-kadi-line/45 bg-kadi-deep/30 hover:border-white/25"
      }`}
    >
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg" aria-hidden="true">
        {icon}
      </span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-2 text-sm font-bold text-white">
          {title}
          <span
            class={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
              on ? "bg-kadi-gold text-kadi-ink" : "bg-white/10 text-white/60"
            }`}
          >
            {badge ?? (on ? "on" : "off")}
          </span>
        </span>
        <span class="mt-0.5 block text-[11px] leading-snug text-white/50">
          {sub}
        </span>
      </span>
    </button>
  );
}

const DIFFICULTIES: {
  id: Difficulty;
  label: string;
  emoji: string;
  blurb: string;
}[] = [
  { id: "easy", label: "Easy", emoji: "😌", blurb: "Pole pole" },
  { id: "medium", label: "Normal", emoji: "🧠", blurb: "Kawaida" },
  { id: "hard", label: "Hard", emoji: "🔥", blurb: "Moto" },
];

export function SettingsScreen({
  origin,
  settings,
  stats,
  hasSave,
  isCustom,
  onNewCustom,
  onEditCustom,
  onBack,
  onSave,
  onResetStats,
  onClearSave,
  onClearCustoms,
  onClearHistory,
}: SettingsScreenProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmCustomsClear, setConfirmCustomsClear] = useState(false);
  const [confirmHistoryClear, setConfirmHistoryClear] = useState(false);
  const rulesLocked = origin === "game";

  return (
    <ScreenFrame width="lg">
      <PageHeader
        title="Settings"
        subtitle={
          rulesLocked
            ? "Sound and hints only during a match."
            : "Set once, play your way."
        }
        onBack={onBack}
      />

      <div class="mt-2 min-h-0 flex-1 overflow-y-auto no-scrollbar overscroll-contain pb-2">
        <div class="md:grid md:grid-cols-2 md:items-start md:gap-5 md:[&>section]:mt-0">
          <Section level="1" title="Sound & help" sub="Works right away.">
            <ToggleRow
              icon={settings.sound ? "🔊" : "🔇"}
              title="Sound"
              sub="Game sounds on or off."
              on={settings.sound}
              onPress={() => onSave({ sound: !settings.sound })}
            />
            <ToggleRow
              icon={settings.haptics ? "📳" : "🚫"}
              title="Vibration"
              sub="Small buzz as you play (mobile)."
              on={settings.haptics}
              onPress={() => onSave({ haptics: !settings.haptics })}
            />
            <ToggleRow
              icon={settings.animations ? "✨" : "🌙"}
              title="Animations"
              sub="Calm reduces movement."
              on={settings.animations}
              onPress={() => onSave({ animations: !settings.animations })}
            />
            <ToggleRow
              icon="💡"
              title="Hints"
              sub="Show hints on your turn."
              on={settings.coach}
              onPress={() => onSave({ coach: !settings.coach })}
            />
            <ToggleRow
              icon="🃏"
              title="Jokers"
              sub="Jokers in the deck for all tables."
              on={settings.jokersEnabled}
              onPress={() => onSave({ jokersEnabled: !settings.jokersEnabled })}
            />
          </Section>

          {rulesLocked ? (
            <Section
              level="🔒"
              title="Game setup is locked"
              sub="Finish this game to change it."
            >
              <div class="rounded-2xl border border-kadi-line/45 bg-kadi-deep/30 p-3 text-[11px] leading-relaxed text-white/55">
                Change it when you start the next game.
              </div>
            </Section>
          ) : (
            <Section
              level="2"
              title="Game rules"
              sub="Used for your next game. Pick your rules on the Play screen."
            >
              <p class="text-xs font-bold uppercase tracking-widest text-white/50">
                Bots
              </p>
              <div class="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={settings.difficulty === d.id}
                    onClick={() => onSave({ difficulty: d.id })}
                    class={`rounded-2xl border py-3 font-bold capitalize transition active:scale-95 ${
                      settings.difficulty === d.id
                        ? "border-kadi-gold bg-kadi-gold text-kadi-ink"
                        : "border-kadi-line/45 bg-kadi-deep/30 text-white hover:border-kadi-gold/40"
                    }`}
                  >
                    {d.emoji} {d.label}
                    <span class="block text-[10px] font-normal">{d.blurb}</span>
                  </button>
                ))}
              </div>
              {isCustom ? (
                <div class="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={onEditCustom}
                    class="w-full rounded-2xl border border-kadi-gold/50 bg-kadi-gold/10 p-3 text-left transition active:scale-[0.99]"
                  >
                    <span class="text-sm font-bold">✏️ Edit rules</span>
                    <span class="mt-0.5 block text-[11px] text-white/50">
                      Babu, strict and everything else live inside your rules.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onNewCustom}
                    class="w-full rounded-2xl border border-dashed border-kadi-line/60 bg-transparent p-3 text-left transition hover:border-kadi-gold/40 active:scale-[0.99]"
                  >
                    <span class="text-sm font-bold">＋ Custom rules</span>
                    <span class="mt-0.5 block text-[11px] text-white/50">
                      Copy these rules, customize everything, share with friends.
                    </span>
                  </button>
                </div>
              ) : (
                <div class="mt-4 flex flex-col gap-2">
                  <ToggleRow
                    icon="⚡"
                    title={`Special Ace (Babu) ${settings.superAce ? "(on)" : "(off)"}`}
                    sub="A♠ asks for any card you name."
                    on={settings.superAce}
                    onPress={() => onSave({ superAce: !settings.superAce })}
                  />
                  <ToggleRow
                    icon="🚨"
                    title={`Strict rules ${settings.strict ? "(on)" : "(off)"}`}
                    sub="Wrong moves kula +1."
                    on={settings.strict}
                    onPress={() => onSave({ strict: !settings.strict })}
                  />
                  <button
                    type="button"
                    onClick={onNewCustom}
                    class="w-full rounded-2xl border border-dashed border-kadi-line/60 bg-transparent p-3 text-left transition hover:border-kadi-gold/40 active:scale-[0.99]"
                  >
                    <span class="text-sm font-bold">＋ Custom rules</span>
                    <span class="mt-0.5 block text-[11px] text-white/50">
                      Copy the current rules, customize everything, share with friends.
                    </span>
                  </button>
                </div>
              )}
            </Section>
          )}

          <Section
            level="3"
            title="Your scores"
            sub="Stored on this device only."
          >
            <div class="flex items-center gap-2 rounded-2xl border border-kadi-line/45 bg-kadi-deep/30 px-3 py-2.5">
              <span class="text-xl" aria-hidden="true">
                🏆
              </span>
              <div class="flex flex-1 gap-2">
                <Pill>{stats.games} games</Pill>
                <Pill tone="amber">{stats.wins} wins</Pill>
                <Pill tone="green">🔥 {stats.bestStreak} best</Pill>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirmReset) {
                  setConfirmReset(false);
                  onResetStats();
                } else {
                  setConfirmReset(true);
                }
              }}
              class={`w-full rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                confirmReset
                  ? "border-red-400 bg-red-400/15"
                  : "border-kadi-line/45 bg-kadi-deep/30 hover:border-white/25"
              }`}
            >
              <span class="text-sm font-bold">
                {confirmReset ? "Press again to clear" : "🧹 Reset stats"}
              </span>
              <span class="mt-0.5 block text-[11px] text-white/50">
                Clear all wins and streaks.
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmHistoryClear) {
                  setConfirmHistoryClear(false);
                  onClearHistory();
                } else {
                  setConfirmHistoryClear(true);
                }
              }}
              class={`w-full rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                confirmHistoryClear
                  ? "border-red-400 bg-red-400/15"
                  : "border-kadi-line/45 bg-kadi-deep/30 hover:border-white/25"
              }`}
            >
              <span class="text-sm font-bold">
                {confirmHistoryClear
                  ? "Press again to delete"
                  : "🗂 Clear match history"}
              </span>
              <span class="mt-0.5 block text-[11px] text-white/50">
                Removes saved results and the local leaderboard.
              </span>
            </button>
            {hasSave && (
              <button
                type="button"
                onClick={() => {
                  if (confirmClear) {
                    setConfirmClear(false);
                    onClearSave();
                  } else {
                    setConfirmClear(true);
                  }
                }}
                class={`w-full rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                  confirmClear
                    ? "border-red-400 bg-red-400/15"
                    : "border-kadi-line/45 bg-kadi-deep/30 hover:border-white/25"
                }`}
              >
                <span class="text-sm font-bold">
                  {confirmClear
                    ? "Press again to remove"
                    : "⏸ Forfeit saved match"}
                </span>
                <span class="mt-0.5 block text-[11px] text-white/50">
                  Remove your saved game.
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (confirmCustomsClear) {
                  setConfirmCustomsClear(false);
                  onClearCustoms();
                } else {
                  setConfirmCustomsClear(true);
                }
              }}
              class={`w-full rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                confirmCustomsClear
                  ? "border-red-400 bg-red-400/15"
                  : "border-red-400/50 bg-red-400/10"
              }`}
            >
              <span class="text-sm font-bold">
                {confirmCustomsClear ? "Press again to delete" : "🗑 Clear all custom rules"}
              </span>
              <span class="mt-0.5 block text-[11px] text-white/50">
                Removes duplicate/broken profiles created during setup.
              </span>
            </button>
            <div class="rounded-2xl border border-kadi-line/45 bg-kadi-deep/30 p-3 text-[11px] leading-relaxed text-white/45">
              Kadi • plays offline • no account needed.
            </div>
          </Section>
        </div>
      </div>
    </ScreenFrame>
  );
}
