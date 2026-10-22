import { useMemo, useState } from "preact/hooks";
import { RANKS, SUITS, type Rank, type Suit } from "../engine/cards";
import {
  PRESETS,
  decodeRulesConfig,
  encodeRulesConfig,
  migrateRules,
  validateRulesConfig,
  type RulesConfig,
} from "../engine/rules";
import { Section, ToggleRow } from "./settings";
import { PageHeader, ScreenFrame } from "./layout";

export interface RulesBuilderProps {
  /** Clone-from preset or the custom profile being edited. */
  initial: RulesConfig;
  /** Caption for the source, e.g. "Cloned from Bom ni Bom". */
  sourceName: string;
  /** Set when editing a saved custom (enables Delete). */
  editingName: string | null;
  /** Names of other saved customs (uniqueness guard). */
  customNames: string[];
  onBack: () => void;
  onSave: (profile: RulesConfig) => void;
  onDelete: (name: string) => void;
}

const PRESET_NAMES = PRESETS.map((p) => p.name);
const WIN_CHIPS: Rank[] = ["4", "5", "6", "7", "9", "10", "Q", "8"];
const QUESTION_CHIPS: Rank[] = [...RANKS];
const STARTER_CHIPS: Rank[] = [...RANKS, "JOKER"];

function Radio<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { value: T; label: string; blurb: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div>
      <p class="text-xs font-bold uppercase tracking-widest text-white/50">{label}</p>
      <div class="mt-1 grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onPick(o.value)}
            class={`rounded-2xl py-2.5 font-bold transition active:scale-95 ${
              value === o.value ? "bg-yellow-400 text-gray-900" : "bg-white/10 text-white"
            }`}
          >
            {o.label}
            <span class="block text-[10px] font-normal">{o.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stepper({
  title,
  sub,
  value,
  min,
  max,
  onChange,
}: {
  title: string;
  sub: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-xl font-black transition active:scale-95 disabled:opacity-30";
  return (
    <div class="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-bold">{title}</span>
        <span class="mt-0.5 block text-[11px] leading-snug text-white/60">{sub}</span>
      </span>
      <button type="button" aria-label={`Decrease ${title}`} class={btn} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span class="w-8 text-center text-lg font-black text-yellow-300" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label={`Increase ${title}`} class={btn} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function ChipRow<T extends string>({
  label,
  options,
  selected,
  onToggle,
  render,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (v: T) => void;
  render?: (v: T) => string;
}) {
  return (
    <div>
      <p class="text-xs font-bold uppercase tracking-widest text-white/50">{label}</p>
      <div class="mt-1 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o)}
              class={`min-h-11 min-w-11 rounded-xl px-3 py-2 text-sm font-black transition active:scale-95 ${
                on ? "bg-yellow-400 text-gray-900" : "bg-white/10 text-white"
              }`}
            >
              {render ? render(o) : o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    /* clipboard API unavailable — fall through to execCommand */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function RulesBuilder({
  initial,
  sourceName,
  editingName,
  customNames,
  onBack,
  onSave,
  onDelete,
}: RulesBuilderProps) {
  const [draft, setDraft] = useState<RulesConfig>(() => ({ ...initial }));
  const [name, setName] = useState(editingName ?? "");
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch: Partial<RulesConfig>) => setDraft((d) => ({ ...d, ...patch }));
  const toggleListRank = (key: "winningRanks" | "jumpRanks" | "kickbackRanks" | "questionRanks" | "starterBlacklist", rank: Rank) =>
    setDraft((d) => {
      const list = d[key];
      return {
        ...d,
        [key]: list.includes(rank) ? list.filter((r) => r !== rank) : [...list, rank],
      };
    });
  const picks = draft.penaltyPicks;
  const setPick = (rank: "2" | "3" | "JOKER", n: number) =>
    set({ penaltyPicks: { ...picks, [rank]: n } });

  const trimmed = name.trim();
  const problems = useMemo(() => {
    const out = validateRulesConfig({ ...draft, name: trimmed });
    if (trimmed !== "" && PRESET_NAMES.includes(trimmed) && trimmed !== editingName) {
      out.push("That name is taken by a built-in table — pick another.");
    }
    if (trimmed !== "" && customNames.includes(trimmed) && trimmed !== editingName) {
      out.push("You already saved a profile with that name — pick another.");
    }
    return out;
  }, [draft, trimmed, customNames, editingName]);

  const shareCode = useMemo(
    () => encodeRulesConfig({ ...draft, name: trimmed || "Shared table" }),
    [draft, trimmed],
  );

  const handleSave = () => {
    if (problems.length > 0) return;
    const picksOut = { ...draft.penaltyPicks };
    if (!draft.jokersEnabled) delete picksOut["JOKER"];
    else if (picksOut["JOKER"] == null) picksOut["JOKER"] = 5;
    onSave(migrateRules({ ...draft, name: trimmed, penaltyPicks: picksOut }));
  };

  const handleImport = () => {
    try {
      const decoded = decodeRulesConfig(importCode);
      setDraft({ ...decoded });
      setName(decoded.name === "Shared table" ? "" : decoded.name);
      setImportCode("");
      setImportError(null);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "That code did not work.");
    }
  };

  const suitGlyph = (s: Suit) =>
    s === "hearts" ? "♥" : s === "diamonds" ? "♦" : s === "spades" ? "♠" : "♣";

  return (
    <ScreenFrame width="xl">
      <PageHeader
        title="Custom rules 🃏"
        subtitle={`${sourceName}. Changes apply to your next game.`}
        onBack={onBack}
      />

      <div class="mt-2 min-h-0 flex-1 overflow-y-auto no-scrollbar overscroll-contain pb-2">
        <div class="md:grid md:grid-cols-2 md:items-start md:gap-5 md:[&>section]:mt-0">
          <Section level="✏️" title="Name your rules" sub="Saved on this device. Share with a code.">
            <input
              type="text"
              value={name}
              maxLength={28}
              placeholder="Estate Sunday"
              aria-label="Rules name"
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none"
            />
          </Section>
          <Section level="📝" title="Short description" sub="Shown in the rules picker. One sentence.">
            <input
              type="text"
              value={draft.description ?? ''}
              maxLength={80}
              placeholder="Family penalties, latest replaces, Jokers hit hard."
              aria-label="Rules description"
              onInput={(e) => set({ description: (e.target as HTMLInputElement).value })}
              class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none"
            />
          </Section>

          <Section level="⚡" title="Penalty cards (2, 3, Joker)" sub="How they stack and what they cost.">
            <Radio
              label="How penalties stack"
              value={draft.penaltyMatchMode}
              onPick={(v) => set({ penaltyMatchMode: v })}
              options={[
                { value: "family", label: "Family", blurb: "Rank or suit" },
                { value: "sameRank", label: "Same rank", blurb: "2 on 2 only" },
                { value: "any", label: "Bom ni bom", blurb: "Any on any" },
              ]}
            />
            <Radio
              label="Stacking"
              value={draft.penaltyAccumulates ? "all" : "top"}
              onPick={(v) => set({ penaltyAccumulates: v === "all" })}
              options={[
                { value: "top", label: "Top takes over", blurb: "Eater picks latest" },
                { value: "all", label: "Eats all", blurb: "Debts add up" },
              ]}
            />
            <ToggleRow
              icon="🃏"
              title="Bom dodge with J/K"
              sub="A lone J or K passes the debt on, unchanged."
              on={draft.dodgePenaltyWithJumpKickback}
              onPress={() => set({ dodgePenaltyWithJumpKickback: !draft.dodgePenaltyWithJumpKickback })}
            />
            <ToggleRow
              icon="🥞"
              title="Allow stacking penalties"
              sub="Off means eat it or block with an Ace."
              on={draft.allowPenaltyStacking}
              onPress={() => set({ allowPenaltyStacking: !draft.allowPenaltyStacking })}
            />
            <Stepper title="Pick for a 2" sub="Cards the next player owes." value={picks["2"] ?? 2} min={1} max={9} onChange={(v) => setPick("2", v)} />
            <Stepper title="Pick for a 3" sub="Cards the next player owes." value={picks["3"] ?? 3} min={1} max={9} onChange={(v) => setPick("3", v)} />
            {draft.jokersEnabled && (
              <Stepper title="Pick for a Joker" sub="Usually the heaviest debt." value={picks["JOKER"] ?? 5} min={1} max={9} onChange={(v) => setPick("JOKER", v)} />
            )}
          </Section>

          <Section level="❓" title="Questions (Q, 8) & Ace" sub="What counts as a question and what an Ace can do.">
            <ChipRow label="Question cards" options={QUESTION_CHIPS} selected={draft.questionRanks} onToggle={(r) => toggleListRank("questionRanks", r)} />
            <ToggleRow
              icon="🎯"
              title="Answers must match suit"
              sub="Answer must be same suit as the question."
              on={draft.mustAnswerSameSuit}
              onPress={() => set({ mustAnswerSameSuit: !draft.mustAnswerSameSuit })}
            />
            <ToggleRow
              icon="🅰️"
              title="Ace answers any question"
              sub="Q♠ + A♦ closes it, any suit."
              on={draft.aceAnswersQuestion}
              onPress={() => set({ aceAnswersQuestion: !draft.aceAnswersQuestion })}
            />
            <ToggleRow
              icon="🧱"
              title="Ace blocks penalty"
              sub="An Ace fungas the debt."
              on={draft.aceBlocksPenalty}
              onPress={() => set({ aceBlocksPenalty: !draft.aceBlocksPenalty })}
            />
            <ToggleRow
              icon="📢"
              title="Ace picks suit"
              sub="A free Ace names the next suit."
              on={draft.aceCallsSuit}
              onPress={() => set({ aceCallsSuit: !draft.aceCallsSuit })}
            />
            <Stepper title="Asking with no answer: draw" sub="Bare question picks this many." value={draft.unansweredQuestionPickCount} min={0} max={5} onChange={(v) => set({ unansweredQuestionPickCount: v })} />
          </Section>

          <Section level="⚡" title="Special Ace (Babu)" sub="The Ace that demands an exact card.">
            <ToggleRow
              icon="⚡"
              title="Babu"
              sub="A lone special Ace demands any card you name."
              on={draft.superAceEnabled}
              onPress={() => set({ superAceEnabled: !draft.superAceEnabled })}
            />
            {draft.superAceEnabled && (
              <ChipRow label="Babu suit" options={[...SUITS]} selected={[draft.specialAceSuit]} onToggle={(s) => set({ specialAceSuit: s })} render={suitGlyph} />
            )}
            <Stepper title="Stacked Aces = Babu" sub="This many stacked Aces always demand." value={draft.superAceMinAces} min={2} max={4} onChange={(v) => set({ superAceMinAces: v })} />
            <Stepper title="Can't give card: draw" sub="Unmet demand picks this many." value={draft.unmetRequestPickCount} min={0} max={5} onChange={(v) => set({ unmetRequestPickCount: v })} />
          </Section>

          <Section level="🏆" title="Winning & Kadi call" sub="What wins the game and the call rules.">
            <ChipRow label="Cards that can win" options={WIN_CHIPS} selected={draft.winningRanks} onToggle={(r) => toggleListRank("winningRanks", r)} />
            <ToggleRow
              icon="1️⃣"
              title="Must play one card to win"
              sub="Only a lone single card can win — no multi-card dumps."
              on={draft.winningDumpMustBeSingle}
              onPress={() => set({ winningDumpMustBeSingle: !draft.winningDumpMustBeSingle })}
            />
            <ToggleRow
              icon="📢"
              title="Must say 'Niko Kadi'"
              sub="Off means silent finishes count."
              on={draft.mustSayNikoKadi}
              onPress={() => set({ mustSayNikoKadi: !draft.mustSayNikoKadi })}
            />
            <ToggleRow
              icon="🪑"
              title="Empty hand blocks wins"
              sub="No one wins while a rival has no cards."
              on={draft.cardlessBlocksWin}
              onPress={() => set({ cardlessBlocksWin: !draft.cardlessBlocksWin })}
            />
            <Stepper title="Win without calling: draw" sub="Clean finish, no prior call: draw this many." value={draft.lateCallPickCount} min={0} max={5} onChange={(v) => set({ lateCallPickCount: v })} />
            <Stepper title="Wrong Kadi call: draw" sub="Calling with no winning hand: draw this many." value={draft.falseKadiPickCount} min={0} max={5} onChange={(v) => set({ falseKadiPickCount: v })} />
            <Stepper title="Late Kadi call: draw" sub="Letting the call window expire: draw this many." value={draft.kadiDelayPickCount} min={0} max={5} onChange={(v) => set({ kadiDelayPickCount: v })} />
          </Section>

          <Section level="🔀" title="Skip (J) & Reverse (K)" sub="J skips, K turns the table.">
            <ChipRow label="Skip cards" options={[...RANKS]} selected={draft.jumpRanks} onToggle={(r) => toggleListRank("jumpRanks", r)} />
            <ChipRow label="Reverse cards" options={[...RANKS]} selected={draft.kickbackRanks} onToggle={(r) => toggleListRank("kickbackRanks", r)} />
            <ToggleRow
              icon="🙅"
              title="Can block skip with J"
              sub="Answer a lone J with your own J."
              on={draft.jumpCounterable}
              onPress={() => set({ jumpCounterable: !draft.jumpCounterable })}
            />
            <ToggleRow
              icon="🔄"
              title="Can block reverse with K"
              sub="Answer a lone K with your own K."
              on={draft.kickbackCounterable}
              onPress={() => set({ kickbackCounterable: !draft.kickbackCounterable })}
            />
            <ToggleRow
              icon="👥"
              title="2 players: J = question"
              sub="Heads-up, a J needs an answer like a question."
              on={draft.twoPlayerJumpAsQuestion}
              onPress={() => set({ twoPlayerJumpAsQuestion: !draft.twoPlayerJumpAsQuestion })}
            />
            <ToggleRow
              icon="👥"
              title="2 players: K = question"
              sub="Heads-up, a K needs an answer like a question."
              on={draft.twoPlayerKickbackAsQuestion}
              onPress={() => set({ twoPlayerKickbackAsQuestion: !draft.twoPlayerKickbackAsQuestion })}
            />
          </Section>

          <Section level="🃏" title="Deck & dealing" sub="What gets dealt and what can't start.">
            <ToggleRow
              icon="🃏"
              title="Include Jokers"
              sub="Off removes both Jokers entirely."
              on={draft.jokersEnabled}
              onPress={() => set({ jokersEnabled: !draft.jokersEnabled })}
            />
            <Stepper title="Cards per player" sub="Opening hand size." value={draft.dealCount} min={2} max={7} onChange={(v) => set({ dealCount: v })} />
            <ChipRow label="Can't start with" options={STARTER_CHIPS} selected={draft.starterBlacklist} onToggle={(r) => toggleListRank("starterBlacklist", r)} />
          </Section>

          <Section level="🚨" title="Mistakes" sub="What happens when you play wrong.">
            <ToggleRow
              icon="🚨"
              title="Strict: wrong play = penalty + lose turn"
              sub="Wrong moves kula and lose the turn."
              on={draft.strictWrongPlay}
              onPress={() => set({ strictWrongPlay: !draft.strictWrongPlay })}
            />
            <Stepper title="Wrong play: draw" sub="Illegal move picks this many." value={draft.invalidPlayPickCount} min={0} max={5} onChange={(v) => set({ invalidPlayPickCount: v })} />
          </Section>

          <Section level="🔗" title="Share it" sub="A code friends paste on their devices — no account, offline.">
            <textarea
              readOnly
              rows={3}
              value={shareCode}
              aria-label="Share code"
              onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
              class="w-full rounded-2xl border border-white/10 bg-black/30 p-3 font-mono text-[10px] break-all text-white/70 focus:border-yellow-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                void copyText(shareCode).then((ok) => {
                  setCopied(ok);
                  if (ok) window.setTimeout(() => setCopied(false), 2000);
                });
              }}
              class="w-full rounded-2xl bg-white/10 p-3 text-sm font-bold transition active:scale-[0.99]"
            >
              {copied ? "✅ Copied!" : "📋 Copy share code"}
            </button>
            <textarea
              rows={2}
              value={importCode}
              placeholder="Paste a friend's code here…"
              aria-label="Import code"
              onInput={(e) => {
                setImportCode((e.target as HTMLTextAreaElement).value);
                setImportError(null);
              }}
              class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 font-mono text-[10px] text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none"
            />
            {importError && (
              <p class="rounded-2xl border border-red-400/40 bg-red-400/10 p-3 text-[11px] text-red-200">{importError}</p>
            )}
            <button
              type="button"
              disabled={importCode.trim() === ""}
              onClick={handleImport}
              class="w-full rounded-2xl bg-white/10 p-3 text-sm font-bold transition active:scale-[0.99] disabled:opacity-40"
            >
              📥 Load from code
            </button>
          </Section>

          <div class="mt-5 flex flex-col gap-2 pb-2 md:col-span-2 lg:sticky lg:bottom-0 lg:z-10 lg:bg-green-950/90 lg:pt-3 lg:backdrop-blur">
            {problems.length > 0 && (
              <p class="rounded-2xl border border-red-400/40 bg-red-400/10 p-3 text-[11px] leading-relaxed text-red-200" role="alert">
                {problems[0]}
              </p>
            )}
            <button
              type="button"
              disabled={problems.length > 0}
              onClick={handleSave}
              class="w-full rounded-2xl bg-yellow-400 p-4 text-base font-black text-gray-900 transition active:scale-[0.99] disabled:opacity-40"
            >
              💾 Save table rules
            </button>
            {editingName && (
              <button
                type="button"
                onClick={() => {
                  if (confirmDelete) onDelete(editingName);
                  else setConfirmDelete(true);
                }}
                class={`w-full rounded-2xl border p-3 text-sm font-bold transition active:scale-[0.99] ${
                  confirmDelete ? "border-red-400 bg-red-400/15 text-red-200" : "border-white/10 bg-white/5"
                }`}
              >
                {confirmDelete ? "Press again to delete this profile" : "🗑 Delete this profile"}
              </button>
            )}
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}
