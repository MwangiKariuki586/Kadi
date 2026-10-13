import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { Difficulty } from "../bots/bot";
import { PRESETS } from "../engine/rules";
import type { Settings, Stats } from "../store/local";
import { Pill } from "./components";

export interface SettingsScreenProps {
  origin: "home" | "game";
  settings: Settings;
  stats: Stats;
  hasSave: boolean;
  onBack: () => void;
  onSave: (patch: Partial<Settings>) => void;
  onResetStats: () => void;
  onClearSave: () => void;
}

function Section({
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
        <h3 class="text-sm font-black text-yellow-200">{title}</h3>
      </div>
      <p class="mt-1 text-[11px] text-white/55">{sub}</p>
      <div class="mt-2 flex flex-col gap-2">{children}</div>
    </section>
  );
}

function ToggleRow({
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
        on ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-white/5"
      }`}
    >
      <span class="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-2 text-sm font-bold">
          {title}
          <span
            class={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
              on ? "bg-yellow-400 text-gray-900" : "bg-white/10 text-white/60"
            }`}
          >
            {badge ?? (on ? "on" : "off")}
          </span>
        </span>
        <span class="mt-0.5 block text-[11px] leading-snug text-white/60">
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
  onBack,
  onSave,
  onResetStats,
  onClearSave,
}: SettingsScreenProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const rulesLocked = origin === "game";

  return (
    <div class="h-dvh overflow-hidden bg-gradient-to-b from-green-950 via-green-900 to-green-950 text-white flex flex-col safe-top safe-bottom">
      <div class="mx-auto flex h-full w-full max-w-md flex-col px-6 pb-4 pt-4">
        <div class="shrink-0">
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            class="inline-flex min-h-11 items-center gap-1.5 px-4 py-2 text-sm font-bold text-white  transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
          >
            <span aria-hidden="true">←</span> Back
          </button>
          <h2 class="mt-2 text-3xl font-black text-yellow-300">Settings ⚙️</h2>
          <p class="mt-0.5 text-xs text-white/60">
            {rulesLocked
              ? "Sound and hints only during a match."
              : "Set once, play your way."}
          </p>
        </div>

        <div class="mt-2 min-h-0 flex-1 overflow-y-auto no-scrollbar overscroll-contain pb-2">
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
              sub="Small buzz as you play."
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
          </Section>

          {rulesLocked ? (
            <Section
              level="🔒"
              title="Game setup is locked"
              sub="Finish this game to change it."
            >
              <div class="rounded-2xl border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-white/60">
                Change it when you start the next game.
              </div>
            </Section>
          ) : (
            <Section
              level="2"
              title="Game setup"
              sub="Used for your next game."
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
                    class={`rounded-2xl py-3 font-bold capitalize transition active:scale-95 ${
                      settings.difficulty === d.id
                        ? "bg-yellow-400 text-gray-900"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    {d.emoji} {d.label}
                    <span class="block text-[10px] font-normal">{d.blurb}</span>
                  </button>
                ))}
              </div>
              <p class="mt-1 text-xs font-bold uppercase tracking-widest text-white/50">
                Cards
              </p>
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  aria-pressed={settings.presetName === p.name}
                  onClick={() => onSave({ presetName: p.name })}
                  class={`w-full rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                    settings.presetName === p.name
                      ? "border-yellow-400 bg-yellow-400/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <span class="text-sm font-bold">{p.name}</span>
                  <span class="mt-0.5 block text-[11px] text-white/60">
                    {p.jokersEnabled ? "With Jokers" : "No Jokers"} •{" "}
                    {p.dealCount} cards each
                  </span>
                </button>
              ))}
              <ToggleRow
                icon="⚡"
                title={`Babu ${settings.superAce ? "(on)" : "(off)"}`}
                sub="A♠ asks for any card you name."
                on={settings.superAce}
                onPress={() => onSave({ superAce: !settings.superAce })}
              />
              <ToggleRow
                icon="🚨"
                title={`Strict table ${settings.strict ? "(on)" : "(off)"}`}
                sub="Wrong moves kula +1."
                on={settings.strict}
                onPress={() => onSave({ strict: !settings.strict })}
              />
            </Section>
          )}

          <Section
            level="3"
            title="Your scores"
            sub="Stored on this phone only."
          >
            <div class="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5">
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
                  : "border-white/10 bg-white/5"
              }`}
            >
              <span class="text-sm font-bold">
                {confirmReset ? "Tap again to clear" : "🧹 Reset stats"}
              </span>
              <span class="mt-0.5 block text-[11px] text-white/60">
                Clear all wins and streaks.
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
                    : "border-white/10 bg-white/5"
                }`}
              >
                <span class="text-sm font-bold">
                  {confirmClear
                    ? "Tap again to remove"
                    : "⏸ Forfeit saved match"}
                </span>
                <span class="mt-0.5 block text-[11px] text-white/60">
                  Remove your saved game.
                </span>
              </button>
            )}
            <div class="rounded-2xl border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-white/60">
              Kadi • plays offline • no account needed.
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
