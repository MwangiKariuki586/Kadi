import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import { chooseMove, shouldDeclareKadi, type Difficulty } from "./bots/bot";
import type { Card, Rank, Suit } from "./engine/cards";
import { cardLabel } from "./engine/cards";
import { PRESETS, STANDARD_MAUA, type RulesConfig } from "./engine/rules";
import { createGame, topCard, type GameState } from "./engine/state";
import {
  canDeclareKadi,
  canFinishNow,
  declareKadi,
  fineKadiDelay,
  isAceAnswerCombo,
  isSuperAceCombo,
  legalSingles,
  passOrPick,
  playCombo,
  resolveWrongPlay,
  tryDeclareKadi,
  validateCombo,
} from "./engine/validator";
import { store, type ActiveGameSave, type Settings, type Stats } from "./store/local";
import {
  CardRequestPicker,
  CardView,
  CoachBar,
  EventBanner,
  KadiBuzzer,
  Pill,
  QuitConfirmModal,
  SuitPicker,
  Toast,
} from "./ui/components";
import { SettingsScreen } from "./ui/settings";
import {
  describeDeal,
  describeDelayKadi,
  describeFalseKadi,
  describeKadi,
  describePick,
  describePlay,
  describeResume,
  describeWrongPlay,
  snapshotState,
  turnCoach,
  type FeedEvent,
} from "./ui/feed";
import { haptics, isHapticsEnabled, setHapticsEnabled } from "./ui/haptics";
import { isMuted, setMuted, sfx } from "./ui/sounds";
import { applyMotionPreference } from "./ui/motion";

type Screen = "home" | "lobby" | "game" | "settings";

const BOT_NAMES = ["Jabari", "Amani", "Zawadi", "Neema"];
const NAMES = ["You", ...BOT_NAMES];

/**
 * Call-window: when your turn starts with a clean, winnable hand and no
 * declaration yet, you have this long to shout KADI before delays are fined.
 * Keep in sync with the `.anim-kadi-window` drain animation in index.css.
 */
const KADI_WINDOW_MS = 2000;

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [numBots, setNumBots] = useState(2);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [preset, setPreset] = useState<RulesConfig>(STANDARD_MAUA);
  const [superAceOn, setSuperAceOn] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [stats, setStats] = useState<Stats>({
    games: 0,
    wins: 0,
    bestStreak: 0,
    streak: 0,
  });

  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [suitPickerFor, setSuitPickerFor] = useState<Card[] | null>(null);
  const [superPickerFor, setSuperPickerFor] = useState<Card[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [booted, setBooted] = useState(false);
  const [resumable, setResumable] = useState<ActiveGameSave | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [coachOn, setCoachOn] = useState(false);
  const [strictOn, setStrictOn] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(isHapticsEnabled());
  const [animationsOn, setAnimationsOn] = useState(true);
  const [settingsOrigin, setSettingsOrigin] = useState<"home" | "game">("home");

  const pushFeed = useCallback((...evts: FeedEvent[]) => {
    setFeed((f) => [...f, ...evts].slice(-15));
  }, []);

  const stateRef = useRef<GameState | null>(null);
  const recordedRef = useRef(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const [kadiWindow, setKadiWindow] = useState(false);
  const kadiWindowRef = useRef<{
    turn: number;
    status: "idle" | "open" | "done";
    deadline: number;
    armed: boolean;
    /** True once this turn's window expired unpressed: a late press still declares, but pays the delay fine. */
    missed: boolean;
  }>({ turn: -1, status: "idle", deadline: 0, armed: false, missed: false });
  const kadiTimerRef = useRef<number>(0);
  const state = stateRef.current;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const bump = useCallback(() => setTick((t) => t + 1), []);
  void tick;

  /** Close the KADI call-window quietly (pressed, acted, or turn moved on). */
  const closeKadiWindow = useCallback(() => {
    window.clearTimeout(kadiTimerRef.current);
    kadiTimerRef.current = 0;
    kadiWindowRef.current.armed = false;
    if (kadiWindowRef.current.status === "open") {
      kadiWindowRef.current.status = "done";
    }
    setKadiWindow(false);
  }, []);

  /**
   * Expire a call-window: mark the turn as missed and hide the bar.
   * Sitting out is free — the delay fine lands only if the player presses
   * late afterwards. Idempotent per turn.
   */
  const expireKadiWindow = useCallback(() => {
    const w = kadiWindowRef.current;
    if (w.status !== "open") return;
    w.status = "done";
    w.armed = false;
    w.missed = true;
    window.clearTimeout(kadiTimerRef.current);
    kadiTimerRef.current = 0;
    setKadiWindow(false);
  }, []);

  /** Arm the expiry timer for the window's remaining time (re-arms after HMR). */
  const armKadiWindow = useCallback(() => {
    const w = kadiWindowRef.current;
    window.clearTimeout(kadiTimerRef.current);
    kadiTimerRef.current = window.setTimeout(
      () => {
        kadiWindowRef.current.armed = false;
        expireKadiWindow();
      },
      Math.max(0, w.deadline - Date.now()),
    );
    w.armed = true;
  }, [expireKadiWindow]);

  /** Restore a saved match into the live table (transient UI reset). */
  const restoreSave = useCallback(
    (save: ActiveGameSave) => {
      stateRef.current = save.state;
      recordedRef.current = false;
      setNumBots(save.meta.numBots);
      setDifficulty(save.meta.difficulty);
      const p = PRESETS.find((x) => x.name === save.meta.presetName);
      if (p) setPreset(p);
      setSuperAceOn(save.meta.superAce);
      setStrictOn(save.state.config.strictWrongPlay);
      setSelected([]);
      setSuitPickerFor(null);
      setSuperPickerFor(null);
      setBusy(false);
      setScreen("game");
      setFeed([describeResume(save.state.currentPlayer, NAMES)]);
      bump();
    },
    [bump],
  );

  /**
   * Leave the table for Home. Abandoning clears the save; otherwise the live
   * match is snapshotted so Home can offer Continue.
   */
  const quitToHome = useCallback(
    (abandon: boolean) => {
      if (abandon) {
        void store.clearActiveGame();
        setResumable(null);
      } else {
        const st = stateRef.current;
        if (st && !st.gameOver) {
          setResumable({
            state: JSON.parse(JSON.stringify(st)) as GameState,
            meta: {
              numBots: st.hands.length - 1,
              difficulty,
              presetName: preset.name,
              superAce: st.config.superAceEnabled,
              savedAt: Date.now(),
            },
          });
        }
      }
      setConfirmQuit(false);
      stateRef.current = null;
      setScreen("home");
      bump();
    },
    [bump, difficulty, preset],
  );

  const startGame = useCallback(() => {
    const config: RulesConfig = {
      ...preset,
      superAceEnabled: superAceOn,
      strictWrongPlay: strictOn,
    };
    const st = createGame({ numPlayers: 1 + numBots, config });
    stateRef.current = st;
    recordedRef.current = false;
    setSelected([]);
    setSuitPickerFor(null);
    setSuperPickerFor(null);
    setConfirmQuit(false);
    setScreen("game");
    setFeed([describeDeal(topCard(st))]);
    sfx.shuffle();
    haptics.tap();
    bump();
  }, [numBots, preset, superAceOn, strictOn, bump]);

  /** Single write-through for all Settings page + quick toggles. */
  const savePatch = useCallback((patch: Partial<Settings>) => {
    if (patch.difficulty !== undefined) setDifficulty(patch.difficulty);
    if (patch.presetName !== undefined) {
      const p = PRESETS.find((x) => x.name === patch.presetName);
      if (p) setPreset(p);
    }
    if (patch.superAce !== undefined) setSuperAceOn(patch.superAce);
    if (patch.coach !== undefined) setCoachOn(patch.coach);
    if (patch.strict !== undefined) setStrictOn(patch.strict);
    if (patch.sound !== undefined) {
      setMutedState(!patch.sound);
      setMuted(!patch.sound);
    }
    if (patch.haptics !== undefined) {
      setHapticsOn(patch.haptics);
      setHapticsEnabled(patch.haptics);
    }
    if (patch.animations !== undefined) {
      setAnimationsOn(patch.animations);
      applyMotionPreference(patch.animations);
    }
    void store.saveSettings(patch);
  }, []);

  const openSettings = useCallback(
    (from: "home" | "game") => {
      setSettingsOrigin(from);
      setScreen("settings");
      haptics.tap();
    },
    [],
  );

  // ---- boot: settings, stats, then auto-resume a live match (no taps) ----
  useEffect(() => {
    void store.getStats().then(setStats);
    void store.getSettings().then((s) => {
      setDifficulty(s.difficulty);
      const p = PRESETS.find((x) => x.name === s.presetName);
      if (p) setPreset(p);
      setSuperAceOn(s.superAce);
      setCoachOn(s.coach);
      setStrictOn(s.strict);
      setMutedState(!s.sound);
      setMuted(!s.sound);
      setHapticsOn(s.haptics);
      setHapticsEnabled(s.haptics);
      setAnimationsOn(s.animations);
      applyMotionPreference(s.animations);
    });
    void store.loadActiveGame().then((save) => {
      if (save) {
        setResumable(save);
        restoreSave(save);
        flash("Resumed!");
      }
      setBooted(true);
    });
  }, [restoreSave, flash]);

  // ---- bot loop: any non-human turn advances after a thinking delay ----
  // A refusal keeps the turn, so the bot may act several times in a row
  // (bounded — a kept turn that keeps nothing eventually picks).
  const currentPlayer = state?.currentPlayer ?? 0;
  const gameOver = state?.gameOver ?? false;
  useEffect(() => {
    if (screen !== "game" || !stateRef.current || stateRef.current.gameOver)
      return;
    const st = stateRef.current;
    if (st.currentPlayer === 0) return;
    setBusy(true);
    let actions = 0;
    let id = 0;
    const runBot = () => {
      const s = stateRef.current;
      if (!s || s.gameOver) {
        setBusy(false);
        return;
      }
      const me = s.currentPlayer;
      if (me === 0) {
        setBusy(false);
        return;
      }
      if (actions >= 4) {
        // Safety valve: a kept turn that never ends picks and passes on.
        const stuck = snapshotState(s, me);
        const pr = passOrPick(s, me);
        pushFeed(...describePick(stuck, me, NAMES, pr.picked, pr.skipped));
        setBusy(false);
        bump();
        return;
      }
      actions += 1;
      const before = snapshotState(s, me);
      if (difficulty !== "easy" || Math.random() < 0.6) {
        if (shouldDeclareKadi(s, me)) {
          declareKadi(s, me);
          sfx.kadi();
        }
      }
      const move = chooseMove(s, me, difficulty);
      let keepGoing = false;
      if (move) {
        const r = playCombo(
          s,
          me,
          move.cards,
          move.declaredSuit,
          move.requestedCard ?? null,
        );
        if (r.ok) {
          pushFeed(
            ...describePlay(before, s, me, NAMES, move.cards, {
              won: r.won,
              cardless: r.becameCardless,
              fined: r.fined,
            }),
          );
          if (r.won) sfx.win();
          else sfx.play();
          keepGoing = r.keptTurn === true && !r.won;
        } else {
          // Should never happen (moves are pre-validated) — narrate instead
          // of silently swallowing so ghosts leave evidence, not confusion.
          pushFeed({
            icon: "🐞",
            text: `${NAMES[me]} stalls — illegal move blocked (${move.cards.map(cardLabel).join(" + ")})`,
            tone: "info",
          });
        }
      } else {
        const pr = passOrPick(s, me);
        pushFeed(...describePick(before, me, NAMES, pr.picked, pr.skipped));
        sfx.pick();
      }
      if (keepGoing) {
        id = window.setTimeout(runBot, 500 + Math.random() * 300);
      } else {
        setBusy(false);
        bump();
      }
    };
    id = window.setTimeout(runBot, 650 + Math.random() * 350);
    return () => window.clearTimeout(id);
  }, [screen, currentPlayer, gameOver, difficulty, bump, pushFeed]);

  // ---- KADI call-window: shout within 2s of a clean, winnable turn start ----
  // Opens once per human turn (undeclared + winnable shape + no debts/demands
  // to answer). Acting, pressing, or the turn moving on closes it quietly;
  // expiry only marks the turn missed — sitting out is free. A late press
  // afterwards still declares, but pays the delay fine.
  useEffect(() => {
    const s = stateRef.current;
    const turn = s?.turnNumber ?? -1;
    if (kadiWindowRef.current.turn !== turn) {
      closeKadiWindow();
      kadiWindowRef.current = {
        turn,
        status: "idle",
        deadline: 0,
        armed: false,
        missed: false,
      };
    }
    const win = kadiWindowRef.current;
    const cleanTurn =
      screen === "game" &&
      s &&
      !s.gameOver &&
      s.currentPlayer === 0 &&
      !s.kadiCalls[0] &&
      shouldDeclareKadi(s, 0) &&
      s.pendingPenalty === 0 &&
      s.pendingSkip === 0 &&
      (s.pendingReverse ?? 0) === 0 &&
      !s.activeCardRequest;
    if (!cleanTurn) {
      if (win.status === "open") closeKadiWindow();
      return;
    }
    if (win.status === "idle") {
      win.status = "open";
      win.deadline = Date.now() + KADI_WINDOW_MS;
      setKadiWindow(true);
      armKadiWindow();
    } else if (win.status === "open") {
      if (Date.now() >= win.deadline) expireKadiWindow();
      else if (!win.armed) armKadiWindow();
    }
    return () => {
      window.clearTimeout(kadiTimerRef.current);
      kadiWindowRef.current.armed = false;
    };
  }, [
    screen,
    currentPlayer,
    tick,
    gameOver,
    bump,
    pushFeed,
    flash,
    expireKadiWindow,
    closeKadiWindow,
    armKadiWindow,
  ]);

  // ---- record result once (finished games are never resumed) ----
  useEffect(() => {
    if (screen === "game" && state?.gameOver && !recordedRef.current) {
      recordedRef.current = true;
      void store.clearActiveGame();
      setResumable(null);
      const won = state.winnerIndex === 0;
      if (won) {
        sfx.win();
        haptics.win();
      } else {
        sfx.lose();
      }
      void store.recordResult(won).then(setStats);
    }
  }, [screen, state?.gameOver, state?.winnerIndex]);

  // ---- persist the live match every committed change ----
  useEffect(() => {
    if (screen !== "game" || !stateRef.current || stateRef.current.gameOver)
      return;
    const st = stateRef.current;
    void store.saveActiveGame({
      state: JSON.parse(JSON.stringify(st)) as GameState,
      meta: {
        numBots: st.hands.length - 1,
        difficulty,
        presetName: preset.name,
        superAce: st.config.superAceEnabled,
        savedAt: Date.now(),
      },
    });
  }, [screen, tick, difficulty, preset]);

  const hints = useMemo(() => {
    if (!state || state.currentPlayer !== 0 || state.gameOver)
      return new Set<string>();
    return new Set(legalSingles(state, 0).map((c) => c.id));
  }, [state, currentPlayer, gameOver]);

  // Live KADI! threat per seat: declared AND finishable in one move right now.
  // Recomputed per committed move (tick), not per tap/selection render.
  // (state identity is stable — contents are read fresh on each tick.)
  const threats = useMemo(
    () => (state ? state.hands.map((_, i) => canFinishNow(state, i)) : []),
    [tick],
  );

  if (!booted) {
    return (
      <div class="min-h-dvh bg-green-950 text-white flex flex-col items-center justify-center gap-2">
        <div class="text-5xl">🂡</div>
        <p class="text-yellow-300 font-black tracking-wide">KADI</p>
      </div>
    );
  }

  if (screen === "home") {
    return (
      <div class="min-h-dvh bg-gradient-to-b from-green-950 via-green-900 to-green-950 text-white flex flex-col safe-top safe-bottom">
        <Toast message={toast} />
        <div class="flex justify-end px-4 pt-3">
          <button
            type="button"
            aria-label="Open settings"
            onClick={() => openSettings("home")}
            class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 px-3 py-2 text-lg shadow-sm transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
          >
            <span aria-hidden="true">⚙️</span>
          </button>
        </div>
        <div class="flex-1 flex flex-col items-center justify-center px-6 pb-6 text-center">
          <div class="text-6xl mb-2">🂡</div>
          <h1 class="text-5xl font-black tracking-tight text-yellow-300">
            KADI
          </h1>
          <p class="mt-1 text-white/70 text-sm">
            Kenyan card game • plays offline
          </p>
          <div class="mt-4 flex gap-2">
            <Pill>{stats.games} games</Pill>
            <Pill tone="amber">{stats.wins} wins</Pill>
            <Pill tone="green">🔥 Best {stats.bestStreak}</Pill>
          </div>
          <button
            type="button"
            onClick={() => setScreen("lobby")}
            class="mt-8 w-full max-w-xs rounded-2xl bg-yellow-400 py-4 text-xl font-black text-gray-900 shadow-xl active:scale-95 transition"
          >
            ▶ &nbsp;Play
          </button>
          {resumable && (
            <button
              type="button"
              onClick={() => restoreSave(resumable)}
              class="mt-3 w-full max-w-xs rounded-2xl border border-yellow-400/60 bg-yellow-400/10 py-3 text-sm font-black text-yellow-200 active:scale-95 transition"
            >
              ⏸ Continue • {resumable.state.hands.length} players •{" "}
              {resumable.state.currentPlayer === 0 ? "your turn" : "bot turn"} •
              {" "}{resumable.state.hands[0].length} cards
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            class="mt-3 w-full max-w-xs rounded-2xl bg-white/10 py-3 text-sm font-bold text-white active:scale-95 transition"
          >
            {showHelp ? "Hide rules" : "How to play"}
          </button>
          {showHelp && (
            <div class="mt-3 w-full max-w-xs rounded-2xl bg-black/40 border border-white/10 p-4 text-left text-xs leading-relaxed text-white/85 anim-fly-in">
              <p>
                🎯 <b>Goal:</b> finish all your cards in <b>one move</b>. Last
                card must be <b>4 5 6 7 9 10</b>.
              </p>
              <p class="mt-2">
                📢 Say <b class="text-yellow-300">Niko Kadi</b> the turn{" "}
                <i>before</i> you finish, or it doesn&apos;t count. Shouting
                early or late makes you kula +1.
              </p>
              <p class="mt-2">
                🃏 Match <b>suit or rank</b>. J rukas (skip) • K reverses • Q/8
                asks — answer same suit or any Ace • Ace fungas 2/3 • a free
                Ace picks the next suit • 2/3 make the next player kula. No
                finishing on J K 2 3, Q/8 or Ace alone.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (screen === "lobby") {
    return (
      <div class="h-dvh overflow-hidden bg-gradient-to-b from-green-950 via-green-900 to-green-950 text-white flex flex-col safe-top safe-bottom">
        <div class="mx-auto flex h-full w-full max-w-md flex-col px-6 pb-4 pt-4">
          <div class="shrink-0">
            <div class="flex items-center justify-between">
              <button
                type="button"
                aria-label="Back to home"
                onClick={() => setScreen("home")}
                class="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-sm transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
              >
                <span aria-hidden="true">←</span> Back
              </button>
              <button
                type="button"
                aria-label="Open settings"
                onClick={() => openSettings("home")}
                class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 px-3 py-2 text-lg transition active:scale-95"
              >
                <span aria-hidden="true">⚙️</span>
              </button>
            </div>
            <h2 class="mt-2 text-3xl font-black text-yellow-300">New Game</h2>
          </div>

          <div class="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
            <p class="text-xs font-bold uppercase tracking-widest text-white/50">
              Players
            </p>
            <div class="mt-2 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumBots(n)}
                  class={`rounded-2xl py-3 font-black ${numBots === n ? "bg-yellow-400 text-gray-900" : "bg-white/10 text-white"}`}
                >
                  {n + 1}P
                  <span class="block text-[10px] font-normal">
                    you + {n} 🤖
                  </span>
                </button>
              ))}
            </div>

            <p class="mt-5 text-xs font-bold uppercase tracking-widest text-white/50">
              Bots
            </p>
            <div class="mt-2 grid grid-cols-3 gap-2">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => savePatch({ difficulty: d })}
                  class={`rounded-2xl py-3 font-bold capitalize ${difficulty === d ? "bg-yellow-400 text-gray-900" : "bg-white/10 text-white"}`}
                >
                  {d === "easy" ? "😌 Easy" : d === "medium" ? "🧠 Normal" : "🔥 Hard"}
                </button>
              ))}
            </div>

            <p class="mt-5 text-xs font-bold uppercase tracking-widest text-white/50">
              Cards
            </p>
            <div class="mt-2 flex flex-col gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => savePatch({ presetName: p.name })}
                  class={`rounded-2xl border p-3 text-left ${preset.name === p.name ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-white/5"}`}
                >
                  <span class="font-bold text-sm">{p.name}</span>
                  <span class="block text-[11px] text-white/60 mt-0.5">
                    {p.jokersEnabled ? "With Jokers" : "No Jokers"} •{" "}
                    {p.dealCount} cards each
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => savePatch({ superAce: !superAceOn })}
              class={`mt-5 w-full rounded-2xl border p-3 text-left ${superAceOn ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-white/5"}`}
            >
              <span class="font-bold text-sm">
                ⚡ Babu {superAceOn ? "(on)" : "(off)"}
              </span>
              <span class="block text-[11px] text-white/60 mt-0.5">
                A♠ asks for any card you name.
              </span>
            </button>
            <button
              type="button"
              onClick={() => savePatch({ strict: !strictOn })}
              class={`mt-2 w-full rounded-2xl border p-3 text-left ${strictOn ? "border-red-400 bg-red-400/10" : "border-white/10 bg-white/5"}`}
            >
              <span class="font-bold text-sm">
                🚨 Strict table {strictOn ? "(on)" : "(off)"}
              </span>
              <span class="block text-[11px] text-white/60 mt-0.5">
                Wrong moves kula +1.
              </span>
            </button>
          </div>

          <div class="shrink-0 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={startGame}
              class="w-full rounded-2xl bg-yellow-400 py-4 text-xl font-black text-gray-900 shadow-xl active:scale-95 transition"
            >
              Deal me in 🂡
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- settings screen (pause-safe: bots idle while open) ----
  if (screen === "settings") {
    return (
      <div>
        <Toast message={toast} />
        <SettingsScreen
          origin={settingsOrigin}
          settings={{
            sound: !muted,
            difficulty,
            presetName: preset.name,
            superAce: superAceOn,
            coach: coachOn,
            strict: strictOn,
            haptics: hapticsOn,
            animations: animationsOn,
          }}
          stats={stats}
          hasSave={settingsOrigin === "home" && resumable !== null}
          onBack={() => setScreen(settingsOrigin)}
          onSave={(patch) => {
            savePatch(patch);
            haptics.tap();
          }}
          onResetStats={() => {
            void store.resetStats().then((s) => {
              setStats(s);
              flash("Stats cleared 🧹");
            });
          }}
          onClearSave={() => {
            void store.clearActiveGame().then(() => {
              setResumable(null);
              flash("Saved match forfeited ⏸");
            });
          }}
        />
      </div>
    );
  }

  // ---- game screen ----
  if (!state) {
    return (
      <div class="min-h-dvh bg-green-950 text-white flex items-center justify-center">
        <button
          type="button"
          onClick={startGame}
          class="rounded-2xl bg-yellow-400 px-6 py-3 font-black text-gray-900"
        >
          Start
        </button>
      </div>
    );
  }

  const top = topCard(state);
  const myHand = state.hands[0];
  const myTurn = state.currentPlayer === 0 && !state.gameOver;
  // Buzzer is always live and clickable while the game runs — even with an
  // unwinnable hand or on a bot's turn. Shouting early is the player's risk:
  // a press without a legally winnable hand is fined immediately (no flag
  // set, so the win stays impossible until a proper declaration).
  const kadiHot = shouldDeclareKadi(state, 0);
  // Late cue: this turn's window expired unpressed, but the hand is still
  // ready — shouting now still declares, at the delay fine.
  const kadiLate =
    !state.kadiCalls[0] &&
    myHand.length > 0 &&
    kadiWindowRef.current.turn === state.turnNumber &&
    kadiWindowRef.current.missed;
  const kadiTitle = state.kadiCalls[0]
    ? "KADI already called — go out and finish!"
    : myHand.length === 0
      ? "Cardless — nothing to declare with"
      : kadiHot && kadiLate
        ? `Late KADI — still counts, but fined +${state.config.kadiDelayPickCount ?? 1}`
        : kadiHot
          ? "Niko Kadi! Tap to declare"
          : `Say KADI anytime — a wrong call is fined +${state.config.falseKadiPickCount} on the spot`;
  const selectedCards = selected.flatMap(
    (id) => myHand.find((c) => c.id === id) ?? [],
  );
  const selectedOrder = new Map(selected.map((id, i) => [id, i + 1]));
  const validation =
    selectedCards.length > 0 ? validateCombo(selectedCards, state, 0) : null;
  // An illegal selection disables Play upfront — no tap needed to find out.
  const selectionInvalid = validation != null && !validation.ok;
  const selectionReason = selectionInvalid
    ? reasonText(validation.reason ?? null, state.activeSuit)
    : null;

  const toggleSelect = (card: Card) => {
    if (!myTurn || busy) {
      flash(state.gameOver ? "Game over" : "Wait for your turn…");
      return;
    }
    haptics.tap();
    setSelected((s) =>
      s.includes(card.id) ? s.filter((id) => id !== card.id) : [...s, card.id],
    );
  };

  const doPlay = (
    cards: Card[],
    declared: Suit | null,
    requested?: { rank: Rank; suit: Suit } | null,
  ) => {
    closeKadiWindow();
    const before = snapshotState(state, 0);
    const r = playCombo(state, 0, cards, declared, requested ?? null);
    if (!r.ok) {
      sfx.error();
      haptics.penalty();
      // Strict tables fine the attempt (draw + turn passes); casual rejects free.
      const fined = resolveWrongPlay(state, 0);
      if (fined > 0) {
        pushFeed(describeWrongPlay("You", cards, fined));
        setSelected([]);
        setSuitPickerFor(null);
        setSuperPickerFor(null);
      }
      flash(reasonText(r.reason ?? null, state.activeSuit));
      bump();
      return;
    }
    pushFeed(
      ...describePlay(before, state, 0, NAMES, cards, {
        won: r.won,
        cardless: r.becameCardless,
        fined: r.fined,
      }),
    );
    setSelected([]);
    setSuitPickerFor(null);
    setSuperPickerFor(null);
    if (r.won) {
      // win sfx handled by effect
    } else if (r.fined) {
      sfx.penalty();
      flash(`No call — fined +${r.fined}. Say KADI a turn earlier!`);
    } else if (r.becameCardless) {
      sfx.penalty();
    } else {
      sfx.play();
      haptics.play();
    }
    bump();
  };

  const onPlayPress = () => {
    if (selectedCards.length === 0 || !myTurn) return;
    // Answering a penalty with aces is a pure block — no suit/super picker.
    if (
      state.pendingPenalty === 0 &&
      isSuperAceCombo(selectedCards, state) &&
      !superPickerFor
    ) {
      setSuperPickerFor(selectedCards);
      return;
    }
    // An Ace answering a question never declares: suit auto-follows the Ace.
    const aceAnswers = isAceAnswerCombo(selectedCards, state);
    const needsSuit =
      selectedCards.some((c) => c.rank === "A") &&
      !aceAnswers &&
      state.config.aceCallsSuit &&
      state.pendingPenalty === 0 &&
      state.activeCardRequest == null;
    if (needsSuit && !suitPickerFor) {
      setSuitPickerFor(selectedCards);
      return;
    }
    doPlay(selectedCards, null);
  };

  const onPickPress = () => {
    if (!myTurn || busy) return;
    closeKadiWindow();
    const before = snapshotState(state, 0);
    const r = passOrPick(state, 0);
    pushFeed(...describePick(before, 0, NAMES, r.picked, r.skipped));
    sfx.pick();
    haptics.tap();
    setSelected([]);
    bump();
  };

  const onKadi = () => {
    if (state.gameOver) return;
    if (state.kadiCalls[0]) {
      flash("KADI already called — go out and finish!");
      return;
    }
    if (myHand.length === 0) {
      flash("Cardless — nothing to declare with.");
      return;
    }
    const latePress =
      kadiWindowRef.current.turn === state.turnNumber &&
      kadiWindowRef.current.missed &&
      !state.kadiCalls[0];
    closeKadiWindow();
    // Late shout after a missed window: fine the delay FIRST (no flag set,
    // so the shared pickup rule cannot void anything), then declare. A late
    // press with no winnable hand falls through to the false-call path —
    // one fine only, never stacked.
    if (latePress && shouldDeclareKadi(state, 0)) {
      const fined = fineKadiDelay(state, 0);
      declareKadi(state, 0);
      pushFeed(describeDelayKadi("You", fined));
      pushFeed(describeKadi("You"));
      sfx.penalty();
      haptics.penalty();
      flash(
        fined > 0
          ? `Late KADI — fined +${fined}, but it counts. Go finish!`
          : "Late KADI — it counts. Go finish!",
      );
      bump();
      return;
    }
    const r = tryDeclareKadi(state, 0);
    if (r.ok) {
      sfx.kadi();
      haptics.play();
      pushFeed(describeKadi("You"));
      bump();
    } else if (r.falseCall && r.fined) {
      sfx.penalty();
      haptics.penalty();
      pushFeed(describeFalseKadi("You", r.fined));
      flash(
        `False KADI — no winnable hand, fined +${r.fined}. Need 4 5 6 7 9 10, Q/8 + same-suit answer, or Q/8 + Ace.`,
      );
      bump();
    } else if (r.falseCall) {
      sfx.error();
      flash(
        "False KADI — no winnable hand. Lone A/J/K/2/3/Joker can't finish; Ace only wins answering Q/8.",
      );
      bump();
    }
  };

  return (
    <div class="min-h-dvh bg-gradient-to-b from-green-950 via-green-900 to-green-950 text-white flex flex-col safe-top safe-bottom">
      <Toast message={toast} />
      {suitPickerFor && (
        <SuitPicker
          onCancel={() => setSuitPickerFor(null)}
          onPick={(suit) => doPlay(suitPickerFor, suit)}
        />
      )}
      {superPickerFor && (
        <CardRequestPicker
          hand={myHand}
          onCancel={() => setSuperPickerFor(null)}
          onPick={(rank, suit) => doPlay(superPickerFor, null, { rank, suit })}
        />
      )}
      {confirmQuit && !state.gameOver && (
        <QuitConfirmModal
          onClose={() => setConfirmQuit(false)}
          onExit={() => quitToHome(true)}
          onSaveExit={() => quitToHome(false)}
        />
      )}

      {/* top bar */}
      <div class="flex items-center justify-between px-4 pt-3">
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirmQuit(true)}
            class="text-white/60 text-sm"
          >
            ← Quit
          </button>
          <button
            type="button"
            aria-label="Open settings"
            onClick={() => openSettings("game")}
            class="text-white/60 text-lg leading-none"
          >
            <span aria-hidden="true">⚙️</span>
          </button>
        </div>
        <div class="flex items-center gap-2">
          <Pill>
            {state.direction === 1 ? "↻ clockwise" : "↺ anti-clockwise"}
          </Pill>
          {threats.some(Boolean) && <Pill tone="amber">KADI!</Pill>}
        </div>
        <span class="text-white/60 text-xs">{preset.name}</span>
      </div>

      {/* bots */}
      <div class="flex justify-center gap-3 px-4 pt-2">
        {state.hands.map((hand, i) => {
          if (i === 0) return null;
          const isTurn = state.currentPlayer === i && !state.gameOver;
          return (
            <div
              key={i}
              class={`flex items-center gap-2 rounded-2xl border px-3 py-2 ${isTurn ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-black/30"}`}
            >
              <div class="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg">
                🤖
              </div>
              <div>
                <div class="text-xs font-bold">
                  {BOT_NAMES[(i - 1) % BOT_NAMES.length]}
                  {state.kadiCalls[i] && threats[i] && (
                    <span class="ml-1 text-yellow-300">KADI!</span>
                  )}
                </div>
                <div class="text-[11px] text-white/60">
                  {isTurn && busy ? "thinking…" : `${hand.length} cards`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* center piles */}
      <div class="flex items-center justify-center gap-6 py-4">
        <button
          type="button"
          onClick={onPickPress}
          class="flex flex-col items-center gap-1"
          disabled={!myTurn}
        >
          <div
            class={`rounded-lg border-2 border-dashed ${myTurn ? "border-yellow-400/70" : "border-white/20"} bg-black/30 w-20 h-28 flex flex-col items-center justify-center`}
          >
            <span class="text-2xl">🂠</span>
            <span class="text-[11px] text-white/70 font-bold">
              {state.drawPile.length} left
            </span>
            <span class="text-[10px] text-yellow-300 font-bold">
              {myTurn ? "TAP TO PICK" : ""}
            </span>
          </div>
        </button>
        <div
          class="flex flex-col items-center gap-1 anim-fly-in"
          key={top.id + String(state.discardPile.length)}
        >
          <CardView card={top} large />
          <div class="flex gap-1 h-6">
            {state.pendingPenalty > 0 && (
              <Pill tone="red">Pick {state.pendingPenalty}</Pill>
            )}
            {state.pendingSkip > 0 && (
              <Pill tone="amber">SKIP ×{state.pendingSkip}</Pill>
            )}
            {(state.pendingReverse ?? 0) > 0 && (
              <Pill tone="amber">REVERSE ×{state.pendingReverse}</Pill>
            )}
            {state.activeSuit && (
              <Pill tone="green">Suit: {state.activeSuit}</Pill>
            )}
            {state.activeCardRequest && (
              <Pill tone="amber">
                Need: {state.activeCardRequest.rank}
                {state.activeCardRequest.suit === "hearts"
                  ? "♥"
                  : state.activeCardRequest.suit === "diamonds"
                    ? "♦"
                    : state.activeCardRequest.suit === "spades"
                      ? "♠"
                      : "♣"}
              </Pill>
            )}
          </div>
        </div>
      </div>
      <EventBanner events={feed} />
      {coachOn ? (
        <CoachBar
          msg={turnCoach({
            gameOver: state.gameOver,
            winner:
              state.winnerIndex == null
                ? null
                : state.winnerIndex === 0
                  ? "You"
                  : BOT_NAMES[
                      (state.winnerIndex - 1 + BOT_NAMES.length) %
                        BOT_NAMES.length
                    ],
            myTurn,
            waitingOn:
              BOT_NAMES[
                (state.currentPlayer - 1 + BOT_NAMES.length) % BOT_NAMES.length
              ],
            busyThinking: busy && state.currentPlayer !== 0,
            pendingPenalty: state.pendingPenalty,
            pendingSkip: state.pendingSkip,
            pendingReverse: state.pendingReverse ?? 0,
            activeSuit: state.activeSuit,
            prevSuit: state.lastSuitBeforeRequest ?? null,
            request: state.activeCardRequest,
            topLabel: cardLabel(top),
            selectedCount: selectedCards.length,
            comboValid: validation ? validation.ok : null,
            invalidReason:
              validation && !validation.ok
                ? reasonText(validation.reason ?? null, state.activeSuit)
                : null,
            legalCount: hints.size,
            kadiReady: canDeclareKadi(state, 0) && shouldDeclareKadi(state, 0),
          })}
        />
      ) : (
        <p class="text-center text-xs text-white/50 mb-1">
          {state.gameOver
            ? "Game over"
            : myTurn
              ? "👉 Your turn"
              : `Waiting on ${BOT_NAMES[(state.currentPlayer - 1 + BOT_NAMES.length) % BOT_NAMES.length]}…`}
        </p>
      )}

      {/* hand */}
      <div class="flex-1 flex min-h-0 flex-col justify-end px-4 pb-2">
        {!state.gameOver && (
          <div class="flex shrink-0 flex-col items-center justify-center py-2">
            {kadiWindow && (
              <div
                class="mb-1 flex w-40 flex-col items-center gap-1"
                key={state.turnNumber}
              >
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                  <div class="anim-kadi-window h-full w-full rounded-full bg-gradient-to-r from-yellow-300 to-red-500" />
                </div>
              </div>
            )}
            {kadiLate && kadiHot && (
              <p class="mb-1 text-[11px] font-bold uppercase tracking-widest text-amber-300">
                Late shout costs +1 — but it counts
              </p>
            )}
            <KadiBuzzer urgent={kadiHot} title={kadiTitle} onPress={onKadi} />
          </div>
        )}
        <div class="flex shrink-0 justify-center overflow-x-auto pt-3">
          <div class="flex" style={{ paddingLeft: 8 }}>
            {myHand.map((c) => (
              <div key={c.id} class="-ml-4 first:ml-0">
                <CardView
                  card={c}
                  selected={selected.includes(c.id)}
                  order={selectedOrder.get(c.id) ?? null}
                  hint={hints.has(c.id) && selected.length === 0}
                  onClick={() => toggleSelect(c)}
                />
              </div>
            ))}
            {myHand.length === 0 && (
              <p class="text-white/60 text-sm pb-6">Cardless</p>
            )}
          </div>
        </div>
      </div>

      {/* actions */}
      {selectionInvalid && (
        <p class="px-4 pb-1 text-center text-[11px] font-bold text-red-300">
          ⛔ {selectionReason}
        </p>
      )}
      <div class="px-4 pb-5 flex items-center gap-2">
        <button
          type="button"
          onClick={onPickPress}
          disabled={!myTurn}
          class="flex-1 rounded-2xl bg-white/10 py-3.5 font-bold text-sm disabled:opacity-40 active:scale-95 transition"
        >
          {state.pendingPenalty > 0
            ? `Eat +${state.pendingPenalty}`
            : state.pendingSkip > 0
              ? "Accept skip"
              : (state.pendingReverse ?? 0) > 0
                ? "Accept reverse"
                : "Pick"}
        </button>
        <button
          type="button"
          onClick={onPlayPress}
          disabled={
            !myTurn ||
            selectedCards.length === 0 ||
            (selectionInvalid && !strictOn)
          }
          class={`flex-1 rounded-2xl py-3.5 font-black text-sm active:scale-95 transition disabled:opacity-40 ${
            selectionInvalid
              ? strictOn
                ? "bg-red-500 text-white"
                : "bg-red-500/40 text-white/60"
              : "bg-yellow-400 text-gray-900"
          }`}
        >
          Play{selectedCards.length > 0 ? ` ${selectedCards.length}` : ""}
        </button>
      </div>

      {/* game over */}
      {state.gameOver && (
        <div class="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4">
          <div class="w-full max-w-sm rounded-3xl bg-green-950 border border-yellow-400/40 p-6 text-center anim-fanfare">
            <div class="text-5xl">{state.winnerIndex === 0 ? "🏆" : "😅"}</div>
            <h3 class="mt-2 text-2xl font-black text-yellow-300">
              {state.winnerIndex === 0
                ? "You win 🎉"
                : `${BOT_NAMES[(state.winnerIndex ?? 1) - 1]} wins`}
            </h3>
            <div class="mt-3 flex justify-center gap-2">
              <Pill>{stats.games} games</Pill>
              <Pill tone="amber">{stats.wins} wins</Pill>
              <Pill tone="green">🔥 {stats.streak} streak</Pill>
            </div>
            <button
              type="button"
              onClick={startGame}
              class="mt-5 w-full rounded-2xl bg-yellow-400 py-3.5 font-black text-gray-900"
            >
              Rematch
            </button>
            <button
              type="button"
              onClick={() => quitToHome(true)}
              class="mt-2 w-full rounded-2xl bg-white/10 py-3 text-sm font-bold"
            >
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function reasonText(reason: string | null, activeSuit?: Suit | null): string {
  switch (reason) {
    case "NO_MATCH":
      if (activeSuit) {
        const glyph =
          activeSuit === "hearts"
            ? "♥"
            : activeSuit === "diamonds"
              ? "♦"
              : activeSuit === "spades"
                ? "♠"
                : "♣";
        const name = activeSuit.charAt(0).toUpperCase() + activeSuit.slice(1);
        return `Must follow ${name} ${glyph} — Ace called it.`;
      }
      return "Must match suit or rank of the top card.";
    case "QUESTION_NEEDS_ANSWER":
      return "Q / 8 needs a same-suit answer (4 5 6 7 9 10) in the same move.";
    case "PENALTY_MUST_STACK_OR_BLOCK":
      return "2 / 3 / Joker only stack with other penalties — never with normal cards. Stack, block with Ace, or eat.";
    case "ACE_ONLY_STACKS_WITH_ACE":
      return "An Ace plays solo, with another Ace, or as the answer to Q / 8 (any suit) — never with other normal cards.";
    case "MUST_BE_SAME_RANK":
      return "Combos share one rank — e.g. 7♥ + 7♠. Questions stack (Q/8) and the answer matches the last question (4 5 6 7 9 10 same suit, or Ace any suit); J/K stack together.";
    case "SKIP_MUST_COUNTER_OR_ACCEPT":
      return "Jump! Refuse with any single J to keep your turn, or accept the skip. Stacks can't be refused.";
    case "REVERSE_MUST_COUNTER_OR_ACCEPT":
      return "Kickback! Refuse with any single K to keep your turn, or accept the reversal. Stacks can't be refused.";
    case "UNMET_REQUEST":
      return "Super Ace demand: play the exact card, an Ace, or pick.";
    case "NOT_YOUR_TURN":
      return "Wait for your turn…";
    default:
      return "That move is not legal.";
  }
}
