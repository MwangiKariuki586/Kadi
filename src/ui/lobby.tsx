import { describeRules, PRESETS, type RulesConfig } from "../engine/rules";
import { Icon, type IconName } from "./icons";
import { PageHeader, ScreenFrame } from "./layout";
import { SectionLabel } from "./theme";

const MODES = [
  { bots: 1, label: "2P", sub: "you + 1 🤖" },
  { bots: 2, label: "3P", sub: "you + 2 🤖" },
  { bots: 3, label: "4P", sub: "you + 3 🤖" },
];

function presetIcon(preset: RulesConfig): IconName {
  if (preset.name === "Standard Maua") return "book";
  if (preset.name === "Bom ni Bom") return "crown";
  if (preset.name === "Backstreet Pesa") return "deck";
  return "edit";
}

export interface LobbyScreenProps {
  numBots: number;
  presetName: string;
  customs: RulesConfig[];
  jokersOn: boolean;
  onSelectBots: (bots: number) => void;
  onToggleJokers: () => void;
  onSelectPreset: (name: string) => void;
  onEditCustom: (preset: RulesConfig) => void;
  onNewCustom: () => void;
  onDeal: () => void;
  onBack: () => void;
  onSettings: () => void;
}

export function LobbyScreen({
  numBots,
  presetName,
  customs,
  jokersOn,
  onSelectBots,
  onToggleJokers,
  onSelectPreset,
  onEditCustom,
  onNewCustom,
  onDeal,
  onBack,
  onSettings,
}: LobbyScreenProps) {
  const allPresets = [...PRESETS, ...customs];
  const ruleCount = allPresets.length + 1;
  const lastRuleSpans = ruleCount % 2 === 1;
  return (
    <ScreenFrame width="wide">
      <PageHeader
        title="New"
        accent="Game"
        subtitle="Pick your players, choose a game rule, and get ready to play!"
        onBack={onBack}
        right={
          <button
            type="button"
            aria-label="Open settings"
            onClick={onSettings}
            class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-kadi-line/45 bg-kadi-deep/30 text-white/60 transition hover:border-kadi-gold/40 hover:text-kadi-gold"
          >
            <Icon name="settings" class="h-5 w-5" />
          </button>
        }
      />

      <div class="no-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2 lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-8">
        <div class="flex flex-col gap-4">
          <section>
            <SectionLabel icon="users">Players</SectionLabel>
            <div class="mt-2 grid grid-cols-3 gap-2">
              {MODES.map((mode) => {
                const active = numBots === mode.bots;
                return (
                  <button
                    key={mode.bots}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectBots(mode.bots)}
                    class={`relative flex flex-col items-center rounded-2xl border px-2 py-3 text-center transition active:scale-[0.98] ${
                      active
                        ? "border-kadi-gold bg-kadi-gold text-kadi-ink shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
                        : "border-kadi-line/45 bg-kadi-deep/35 text-white hover:border-kadi-gold/40"
                    }`}
                  >
                    {active && (
                      <span class="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-kadi-ink text-kadi-gold">
                        <Icon name="check" class="h-3 w-3" strokeWidth={2.6} />
                      </span>
                    )}
                    <Icon
                      name="users"
                      class={`h-5 w-5 ${active ? "text-kadi-ink" : "text-white/60"}`}
                    />
                    <span class="mt-1 text-lg font-black">{mode.label}</span>
                    <span
                      class={`text-[10px] font-semibold ${
                        active ? "text-kadi-ink/70" : "text-white/45"
                      }`}
                    >
                      {mode.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <SectionLabel icon="dice">Table options</SectionLabel>
            <div class="mt-2 flex items-center gap-3 rounded-2xl border border-kadi-line/45 bg-kadi-deep/30 p-3">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-xl">
                🃏
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-bold text-white">Jokers</span>
                <span class="mt-0.5 block text-[11px] leading-snug text-white/50">
                  {jokersOn
                    ? "Kula tano 💀"
                    : "No Jokers, only 2s and 3s make you kula."}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={jokersOn}
                aria-label="Jokers"
                onClick={onToggleJokers}
                class={`relative h-8 w-14 shrink-0 rounded-full border transition-colors duration-200 active:scale-95 ${
                  jokersOn
                    ? "border-kadi-gold/70 bg-kadi-gold/25"
                    : "border-white/20 bg-black/40"
                }`}
              >
                <span
                  aria-hidden="true"
                  class={`switch-knob absolute left-1 top-1/2 block h-6 w-6 -translate-y-1/2 rounded-full border-[3px] transition-all duration-200 ${
                    jokersOn
                      ? "translate-x-6 border-kadi-gold bg-kadi-gold"
                      : "translate-x-0 border-white/25 bg-black/80"
                  }`}
                />
              </button>
            </div>
          </section>
        </div>

        <section class="mt-4 lg:mt-0">
          <SectionLabel icon="book">Game rules</SectionLabel>
          <div class="mt-2 grid gap-2 md:grid-cols-2">
            {allPresets.map((preset) => {
              const active = presetName === preset.name;
              const custom = customs.some((c) => c.name === preset.name);
              return (
                <div class="relative" key={preset.name}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectPreset(preset.name)}
                    class={`w-full rounded-2xl border p-3 pr-10 text-left transition active:scale-[0.99] ${
                      active
                        ? "border-kadi-gold bg-kadi-gold/10 shadow-[0_0_26px_rgba(245,197,24,0.08)]"
                        : "border-kadi-line/45 bg-kadi-deep/30 hover:border-kadi-gold/40 hover:bg-white/5"
                    }`}
                  >
                    <span class="flex items-start gap-2.5">
                      <span
                        class={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
                          active
                            ? "border-kadi-gold/50 bg-kadi-gold/15 text-kadi-gold"
                            : "border-white/10 bg-white/5 text-white/55"
                        }`}
                      >
                        <Icon name={presetIcon(preset)} class="h-4 w-4" />
                      </span>
                      <span class="min-w-0">
                        <span class="flex items-center gap-1.5 text-sm font-bold text-white">
                          {preset.name}
                          {custom && (
                            <span class="rounded-full bg-white/8 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white/45">
                              custom
                            </span>
                          )}
                        </span>
                        <span class="mt-0.5 block text-[11px] leading-snug text-white/50">
                          {preset.description ?? describeRules(preset)}
                        </span>
                      </span>
                    </span>
                    {active && (
                      <span class="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full border border-kadi-gold bg-kadi-gold text-kadi-ink">
                        <Icon
                          name="check"
                          class="h-3.5 w-3.5"
                          strokeWidth={2.6}
                        />
                      </span>
                    )}
                  </button>
                  {custom && (
                    <button
                      type="button"
                      aria-label={`Customize ${preset.name}`}
                      onClick={() => onEditCustom(preset)}
                      class="absolute bottom-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-kadi-gold active:scale-95"
                    >
                      <Icon name="edit" class="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={onNewCustom}
              class={`group flex items-start gap-2.5 rounded-2xl border border-dashed border-kadi-line/60 bg-kadi-deep/20 p-3 text-left transition hover:border-kadi-gold/50 hover:bg-white/5 active:scale-[0.99] ${
                lastRuleSpans ? "md:col-span-2" : ""
              }`}
            >
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-kadi-gold/30 bg-kadi-gold/10 text-kadi-gold">
                <Icon name="plus" class="h-5 w-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-bold text-white">
                  Custom rules
                </span>
                <span class="mt-0.5 block text-[11px] text-white/45">
                  Build your own rules from Standard Maua.
                </span>
              </span>
              <Icon
                name="chevronRight"
                class="h-4 w-4 shrink-0 self-center text-white/25 transition group-hover:text-kadi-gold"
              />
            </button>
          </div>
        </section>
      </div>

      <div class="shrink-0 border-t border-white/8 pt-3 md:pt-4">
        <button
          type="button"
          onClick={onDeal}
          class="kadi-gold-button flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-lg font-black md:py-5 md:text-xl"
        >
          <Icon name="dice" class="h-5 w-5 md:h-6 md:w-6" />
          Deal me in
          <Icon name="arrowRight" class="h-5 w-5" />
        </button>
      </div>
    </ScreenFrame>
  );
}
