import { useMemo, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { Card, Suit } from "../engine/cards";
import { passOrPick, playCombo, validateCombo } from "../engine/validator";
import { CardView, Pill } from "./components";
import { haptics } from "./haptics";
import { sfx } from "./sounds";
import { reasonText } from "./reasons";
import {
  CHOICE_BOARDS,
  PLAY_BOARDS,
  buildPracticeTable,
  tableCards,
  type ChoiceBoard,
  type PlayBoard,
} from "./howtoContent";

function suitGlyph(suit: Suit): string {
  return suit === "hearts"
    ? "♥"
    : suit === "diamonds"
      ? "♦"
      : suit === "spades"
        ? "♠"
        : "♣";
}

function playBoard(id: string): PlayBoard {
  const b = PLAY_BOARDS.find((x) => x.id === id);
  if (!b) throw new Error(`unknown board ${id}`);
  return b;
}

function choiceBoard(id: string): ChoiceBoard {
  const b = CHOICE_BOARDS.find((x) => x.id === id);
  if (!b) throw new Error(`unknown board ${id}`);
  return b;
}

type Result = { tone: "good" | "bad" | "almost"; text: string } | null;

const RESULT_STYLE: Record<Exclude<Result, null>["tone"], string> = {
  good: "border-green-400/70 bg-green-400/10 text-green-100",
  bad: "border-red-400/70 bg-red-500/15 text-red-100",
  almost: "border-yellow-400/70 bg-yellow-400/10 text-yellow-100",
};

/** Tap-the-cards practice board backed by the real rules engine. */
export function TryBoard({ board }: { board: PlayBoard }) {
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<Result>(null);
  const [done, setDone] = useState(false);
  const table = useMemo(
    () => buildPracticeTable(board.setup),
    [board, attempt],
  );
  const top = table.discardPile[table.discardPile.length - 1];
  const hand = table.hands[0];
  const order = new Map(selected.map((id, i) => [id, i + 1]));

  const reset = () => {
    setAttempt((a) => a + 1);
    setSelected([]);
    setResult(null);
    setDone(false);
  };

  const toggle = (card: Card) => {
    if (done) return;
    haptics.tap();
    setResult(null);
    setSelected((s) =>
      s.includes(card.id) ? s.filter((id) => id !== card.id) : [...s, card.id],
    );
  };

  const onPlay = () => {
    if (selected.length === 0) {
      setResult({ tone: "bad", text: "Tap a card first, then Play." });
      return;
    }
    const s = buildPracticeTable(board.setup);
    const cards = tableCards(s, selected);
    const v = validateCombo(cards, s, 0);
    if (!v.ok) {
      sfx.error();
      setResult({
        tone: "bad",
        text: `⛔ ${reasonText(v.reason ?? null, s.activeSuit)}`,
      });
      return;
    }
    const solved = board.solutions.some(
      (sol) => sol.join("|") === selected.join("|"),
    );
    if (board.expect) {
      const clone = JSON.parse(JSON.stringify(s));
      const r = playCombo(clone, 0, cards, null, null);
      const hit =
        board.expect === "win"
          ? r.won === true
          : board.expect === "cardless"
            ? r.becameCardless === true
            : (r.fined ?? 0) > 0;
      if (hit && solved) {
        sfx.play();
        haptics.play();
        setDone(true);
        setResult({ tone: "good", text: `✅ ${board.winText}` });
      } else {
        setResult({
          tone: "almost",
          text:
            board.almostText ??
            "Legal move but not the lesson. Reset and try again.",
        });
      }
      return;
    }
    if (solved) {
      sfx.play();
      haptics.play();
      setDone(true);
      setResult({ tone: "good", text: `✅ ${board.winText}` });
    } else {
      setResult({
        tone: "almost",
        text:
          board.almostText ??
          "Legal move but not the lesson. Reset and try again.",
      });
    }
  };

  const onKula = () => {
    if (!board.kula) return;
    const s = buildPracticeTable(board.setup);
    passOrPick(s, 0);
    haptics.tap();
    setDone(true);
    setSelected([]);
    setResult({ tone: "good", text: `✅ ${board.kula.winText}` });
  };

  return (
    <div class="rounded-2xl border border-white/10 bg-black/30 p-3">
      <p class="text-xs font-bold text-white/90">{board.prompt}</p>
      <div class="mt-2 flex items-center justify-center gap-4">
        <div class="flex flex-col items-center gap-1">
          <CardView card={top} large />
          <div class="flex h-6 gap-1">
            {table.pendingPenalty > 0 && (
              <Pill tone="red">Pick {table.pendingPenalty}</Pill>
            )}
            {table.pendingSkip > 0 && (
              <Pill tone="amber">SKIP ×{table.pendingSkip}</Pill>
            )}
            {table.activeCardRequest && (
              <Pill tone="amber">
                Need: {table.activeCardRequest.rank}
                {suitGlyph(table.activeCardRequest.suit)}
              </Pill>
            )}
          </div>
        </div>
      </div>
      <div class="mt-1 flex justify-center">
        <div class="flex" style={{ paddingLeft: 8 }}>
          {hand.map((c) => (
            <div key={`${attempt}-${c.id}`} class="-ml-4 first:ml-0">
              <CardView
                card={c}
                selected={selected.includes(c.id)}
                order={order.get(c.id) ?? null}
                onClick={() => toggle(c)}
              />
            </div>
          ))}
        </div>
      </div>
      {result && (
        <p
          class={`anim-fly-in mt-2 rounded-xl border px-3 py-2 text-center text-xs font-bold ${RESULT_STYLE[result.tone]}`}
        >
          {result.text}
        </p>
      )}
      <div class="mt-2 flex gap-2">
        {board.kula && !done && (
          <button
            type="button"
            onClick={onKula}
            class="flex-1 rounded-2xl bg-white/10 py-2.5 text-xs font-bold active:scale-95 transition"
          >
            {board.kula.label}
          </button>
        )}
        {!done ? (
          <button
            type="button"
            onClick={onPlay}
            class="flex-1 rounded-2xl bg-yellow-400 py-2.5 text-xs font-black text-gray-900 active:scale-95 transition"
          >
            Play{selected.length > 0 ? ` ${selected.length}` : ""}
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            class="flex-1 rounded-2xl bg-white/10 py-2.5 text-xs font-bold active:scale-95 transition"
          >
            ↻ Try again
          </button>
        )}
      </div>
    </div>
  );
}

/** Two-option timing quiz for the Niko Kadi call. */
export function ChoiceBoardView({ board }: { board: ChoiceBoard }) {
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked != null && board.options[picked].correct;

  const choose = (i: number) => {
    setPicked(i);
    if (board.options[i].correct) {
      sfx.play();
      haptics.play();
    } else {
      sfx.error();
    }
  };

  return (
    <div class="rounded-2xl border border-white/10 bg-black/30 p-3">
      <p class="text-xs font-bold text-white/90">{board.prompt}</p>
      <div class="mt-2 flex justify-center">
        <div class="flex" style={{ paddingLeft: 8 }}>
          {board.hand.map((c) => (
            <div key={c.id} class="-ml-4 first:ml-0">
              <CardView card={{ id: c.id, rank: c.rank, suit: c.suit }} />
            </div>
          ))}
        </div>
      </div>
      <div class="mt-2 flex flex-col gap-2">
        {board.options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            onClick={() => choose(i)}
            class={`w-full rounded-2xl border p-3 text-sm font-bold transition active:scale-[0.99] ${
              picked === i
                ? o.correct
                  ? "border-green-400 bg-green-400/10 text-green-100"
                  : "border-red-400 bg-red-500/15 text-red-100"
                : "border-white/10 bg-white/5 text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {picked != null && (
        <p
          class={`anim-fly-in mt-2 rounded-xl border px-3 py-2 text-center text-xs font-bold ${correct ? RESULT_STYLE.good : RESULT_STYLE.bad}`}
        >
          {correct ? "✅ " : "⛔ "}
          {board.options[picked].feedback}
        </p>
      )}
    </div>
  );
}

/** Non-interactive row: a few cards plus the takeaway line. */
export function CardExample({
  cards,
  caption,
}: {
  cards: Card[];
  caption: string;
}) {
  return (
    <div class="rounded-2xl border border-white/10 bg-black/30 p-3">
      <div class="flex justify-center">
        <div class="flex" style={{ paddingLeft: 8 }}>
          {cards.map((c) => (
            <div key={c.id} class="-ml-4 first:ml-0">
              <CardView card={c} />
            </div>
          ))}
        </div>
      </div>
      <p class="mt-2 text-center text-[11px] leading-relaxed text-white/70">
        {caption}
      </p>
    </div>
  );
}

function Section({
  id,
  title,
  line,
  children,
}: {
  id: string;
  title: string;
  line: string;
  children: ComponentChildren;
}) {
  return (
    <section id={`howto-${id}`} class="mt-5 scroll-mt-20">
      <h3 class="text-sm font-black text-yellow-200">{title}</h3>
      <p class="mt-1 text-[11px] leading-relaxed text-white/60">{line}</p>
      <div class="mt-2 flex flex-col gap-2">{children}</div>
    </section>
  );
}

const CHIPS = [
  { id: "goal", label: "🎯 Goal" },
  { id: "kadi", label: "📢 Niko Kadi" },
  { id: "match", label: "🃏 Matching" },
  { id: "powers", label: "⚡ Powers" },
  { id: "kula", label: "🔥 Kula" },
  { id: "babu", label: "👴 Babu" },
  { id: "win", label: "🏆 Winning" },
];

export function HowToScreen({ onBack }: { onBack: () => void }) {
  const jump = (id: string) => {
    try {
      document
        .getElementById(`howto-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      /* DOM unavailable — ignore */
    }
  };

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
          <h2 class="mt-2 text-3xl font-black text-yellow-300">How to play</h2>
          <p class="mt-0.5 text-xs text-white/60">
            Tap through the lessons every board is real Kadi.
          </p>
          <div class="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => jump(c.id)}
                class="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/80 active:scale-95 transition"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div class="mt-2 min-h-0 flex-1 overflow-y-auto no-scrollbar overscroll-contain pb-2">
          <Section
            id="goal"
            title="🎯 Goal"
            line="Finish all your cards in one move. Your last card must be 4, 5, 6, 7, 9 or 10 or an Ace answering a Q/8."
          >
            <TryBoard board={playBoard("goal-pick-winner")} />
            <CardExample
              cards={[
                { id: "gx-q", rank: "Q", suit: "spades" },
                { id: "gx-a", rank: "A", suit: "diamonds" },
              ]}
              caption="An Ace can also finish but only answering a Q or 8. Full lesson in Winning below."
            />
          </Section>

          <Section
            id="kadi"
            title="📢 Niko Kadi"
            line="Shout Niko Kadi the turn before you finish or the win doesn't count. Early or late, you kula +1."
          >
            <ChoiceBoardView board={choiceBoard("kadi-shout-now")} />
            <ChoiceBoardView board={choiceBoard("kadi-too-early")} />
          </Section>

          <Section
            id="match"
            title="🃏 Matching"
            line="Match the top card's suit or rank. Tap cards in order the first one must match."
          >
            <TryBoard board={playBoard("match-one")} />
            <TryBoard board={playBoard("combo-order")} />
          </Section>

          <Section
            id="powers"
            title="⚡ Power cards"
            line="J ruka (next player sits out), K reverses, Q and 8 ask (any Ace can answer), Ace funga or picks a suit."
          >
            <TryBoard board={playBoard("answer-question")} />
            <TryBoard board={playBoard("jump-refuse")} />
            <CardExample
              cards={[
                { id: "hx-a", rank: "A", suit: "clubs" },
                { id: "hx-s", rank: "4", suit: "spades" },
              ]}
              caption="A free Ace picks the next suit here spades. Everyone follows it."
            />
          </Section>

          <Section
            id="kula"
            title="🔥 Kula"
            line="2, 3 and Joker send the next player to kula. Answer with the same family or block with an Ace."
          >
            <TryBoard board={playBoard("block-penalty")} />
            <TryBoard board={playBoard("penalty-choice")} />
            <CardExample
              cards={[
                { id: "hx-2d", rank: "2", suit: "diamonds" },
                { id: "JOKER-1", rank: "JOKER", suit: "none" },
              ]}
              caption="2♦, then Joker (+5). Next plays ♦, another Joker, or an Ace."
            />
            <CardExample
              cards={[
                { id: "hx-2h", rank: "2", suit: "hearts" },
                { id: "JOKER-2", rank: "JOKER", suit: "none" },
              ]}
              caption="Any Joker answers any 2 or 3 — black Joker on 2♥ is legal. No color to match."
            />
          </Section>

          <Section
            id="babu"
            title="👴 Babu"
            line="A♠ names any exact card. Bring it, play an Ace, or kula. Stacked Aces always demand, Babu or not."
          >
            <TryBoard board={playBoard("babu-demand")} />
          </Section>

          <Section
            id="win"
            title="🏆 Winning"
            line="Dump everything in one move, ending clean, with Niko Kadi said a turn earlier."
          >
            <TryBoard board={playBoard("win-clean")} />
            <TryBoard board={playBoard("win-ace-answer")} />
            <TryBoard board={playBoard("win-bad-ending")} />
            <TryBoard board={playBoard("win-no-call")} />
          </Section>
        </div>
      </div>
    </div>
  );
}
