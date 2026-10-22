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
import {
  resolveProfile,
  store,
  type ActiveGameSave,
  type Settings,
  type Stats,
} from "./store/local";
import { createMatchId, type MatchRecord } from "./store/history";
import {
  CardRequestPicker,
  CardView,
  CoachBar,
  EventBanner,
  KadiBuzzer,
  OpponentSeat,
  Pill,
  QuitConfirmModal,
  SuitPicker,
  Toast,
} from "./ui/components";
import { SettingsScreen } from "./ui/settings";
import { RulesBuilder } from "./ui/rulesBuilder";
import { HowToScreen } from "./ui/howto";
import { HomeScreen, ChallengeFriendsModal } from "./ui/home";
import { LobbyScreen } from "./ui/lobby";
import { MyGamesScreen } from "./ui/records";
import { BOT_NAMES, PLAYER_NAMES } from "./ui/players";
import { BrandMark, PageBackdrop, StatsCard } from "./ui/theme";
import { Icon } from "./ui/icons";
import { reasonText } from "./ui/reasons";
import {
  describeDeal,
  describeDelayKadi,
  describeFalseKadi,
  describeKadi,
  describeNotice,
  describePick,
  describePlay,
  describeResume,
  describeStall,
  describeWrongPlay,
  snapshotState,
  turnCoach,
  type FeedEvent,
} from "./ui/feed";
import { haptics, isHapticsEnabled, setHapticsEnabled } from "./ui/haptics";
import { isMuted, setMuted, sfx } from "./ui/sounds";
import { applyMotionPreference } from "./ui/motion";

type Screen =
  | "home"
  | "lobby"
  | "game"
  | "settings"
  | "rules"
  | "howto"
  | "games";

const NAMES = [...PLAYER_NAMES];

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
  const [customs, setCustoms] = useState<RulesConfig[]>([]);
  const [builderInit, setBuilderInit] = useState<{
    initial: RulesConfig;
    sourceName: string;
    editingName: string | null;
  } | null>(null);
  const [superAceOn, setSuperAceOn] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [stats, setStats] = useState<Stats>({
    games: 0,
    wins: 0,
    bestStreak: 0,
    streak: 0,
  });
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [challengeOpen, setChallengeOpen] = useState(false);

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
  const [jokersOn, setJokersOn] = useState(true);
  const [hapticsOn, setHapticsOn] = useState(isHapticsEnabled());
  const [animationsOn, setAnimationsOn] = useState(true);
  const [settingsOrigin, setSettingsOrigin] = useState<"home" | "game">("home");
  const customsRef = useRef<RulesConfig[]>([]);
  /** True when the active table is a saved custom, its flags stand alone. */
  const isCustomActive = !PRESETS.some((p) => p.name === preset.name);

  const pushFeed = useCallback((...evts: FeedEvent[]) => {
    setFeed((f) => [...f, ...evts].slice(-15));
  }, []);

  // Throttled feed notices for dead taps (no state change). Prevents mash-spam
  // from evicting real history out of the capped 15-event window.
  const noticeThrottle = useRef<{ text: string; at: number }>({
    text: "",
    at: 0,
  });
  const pushNotice = useCallback(
    (text: string, turn: number) => {
      const now = Date.now();
      const last = noticeThrottle.current;
      if (last.text === text && now - last.at < 1500) return;
      noticeThrottle.current = { text, at: now };
      pushFeed(describeNotice("You", text, turn));
    },
    [pushFeed],
  );

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

  // Home/Settings-only transient confirmations (Resumed!, Stats cleared…).
  // The game screen uses pushFeed/pushNotice so the event panel stays the
  // single in-game notification channel.
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
   * Sitting out is free, the delay fine lands only if the player presses
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
      setPreset(resolveProfile(save.meta.presetName, customsRef.current));
      setSuperAceOn(save.meta.superAce);
      setStrictOn(save.state.config.strictWrongPlay);
      setSelected([]);
      setSuitPickerFor(null);
      setSuperPickerFor(null);
      setBusy(false);
      setScreen("game");
      setFeed([
        describeResume(save.state.currentPlayer, NAMES, save.state.turnNumber),
      ]);
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
    // Customs stand alone; presets take the lobby Babu/strict overlays.
    const custom = !PRESETS.some((p) => p.name === preset.name);
    const config: RulesConfig = custom
      ? { ...preset, jokersEnabled: jokersOn }
      : {
          ...preset,
          superAceEnabled: superAceOn,
          strictWrongPlay: strictOn,
          jokersEnabled: jokersOn,
        };
    const st = createGame({ numPlayers: 1 + numBots, config });
    stateRef.current = st;
    recordedRef.current = false;
    setSelected([]);
    setSuitPickerFor(null);
    setSuperPickerFor(null);
    setConfirmQuit(false);
    setScreen("game");
    setFeed([describeDeal(topCard(st), st.turnNumber)]);
    sfx.shuffle();
    haptics.tap();
    bump();
  }, [numBots, preset, superAceOn, strictOn, jokersOn, bump]);

  /** Single write-through for all Settings page + quick toggles. */
  const savePatch = useCallback((patch: Partial<Settings>) => {
    if (patch.difficulty !== undefined) setDifficulty(patch.difficulty);
    if (patch.presetName !== undefined) {
      const p = [...PRESETS, ...customsRef.current].find(
        (x) => x.name === patch.presetName,
      );
      if (p) setPreset({ ...p });
    }
    if (patch.superAce !== undefined) setSuperAceOn(patch.superAce);
    if (patch.coach !== undefined) setCoachOn(patch.coach);
    if (patch.strict !== undefined) setStrictOn(patch.strict);
    if (patch.jokersEnabled !== undefined) setJokersOn(patch.jokersEnabled);
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

  const openSettings = useCallback((from: "home" | "game") => {
    setSettingsOrigin(from);
    setScreen("settings");
    haptics.tap();
  }, []);

  const openBuilderNew = useCallback(() => {
    setBuilderInit({
      initial: { ...preset },
      sourceName: `Cloned from ${preset.name}`,
      editingName: null,
    });
    setScreen("rules");
    haptics.tap();
  }, [preset]);

  const openBuilderEdit = useCallback(() => {
    setBuilderInit({
      initial: { ...preset },
      sourceName: preset.name,
      editingName: preset.name,
    });
    setScreen("rules");
    haptics.tap();
  }, [preset]);

  const saveCustomProfile = useCallback(
    (profile: RulesConfig) => {
      void store.saveCustomRules(profile).then((next) => {
        setCustoms(next);
        customsRef.current = next;
        setPreset({ ...profile });
        void store.saveSettings({ presetName: profile.name });
        setBuilderInit(null);
        setScreen("settings");
        flash("Table rules saved 💾");
      });
    },
    [flash],
  );

  const deleteCustomProfile = useCallback(
    (name: string) => {
      void store.deleteCustomRules(name).then((next) => {
        setCustoms(next);
        customsRef.current = next;
        setPreset({ ...STANDARD_MAUA });
        void store.saveSettings({ presetName: STANDARD_MAUA.name });
        setBuilderInit(null);
        setScreen("settings");
        flash("Profile deleted 🗑");
      });
    },
    [flash],
  );

  // ---- boot: customs, settings, stats, then auto-resume a live match (no taps) ----
  useEffect(() => {
    void store.getStats().then(setStats);
    void store.getMatchHistory().then(setHistory);
    void store
      .getCustomRules()
      .then((cs) => {
        setCustoms(cs);
        customsRef.current = cs;
        return store.getSettings();
      })
      .then((s) => {
        setDifficulty(s.difficulty);
        setPreset(resolveProfile(s.presetName, customsRef.current));
        setSuperAceOn(s.superAce);
        setCoachOn(s.coach);
        setStrictOn(s.strict);
        setJokersOn(s.jokersEnabled);
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
  // (bounded, a kept turn that keeps nothing eventually picks).
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
          // Should never happen (moves are pre-validated), narrate instead
          // of silently swallowing so ghosts leave evidence, not confusion.
          pushFeed(
            describeStall(
              NAMES[me],
              move.cards.map(cardLabel).join(" + "),
              s.turnNumber,
            ),
          );
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
  // expiry only marks the turn missed, sitting out is free. A late press
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
      void store
        .recordMatch({
          id: createMatchId(),
          at: Date.now(),
          playerNames: NAMES.slice(0, state.hands.length),
          winnerIndex: state.winnerIndex ?? 0,
          difficulty,
          presetName: preset.name,
          turns: state.turnNumber,
        })
        .then(setHistory);
    }
  }, [screen, state?.gameOver, state?.winnerIndex, difficulty, preset.name]);

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
  // (state identity is stable, contents are read fresh on each tick.)
  const threats = useMemo(
    () => (state ? state.hands.map((_, i) => canFinishNow(state, i)) : []),
    [tick],
  );

  if (!booted) {
    return (
      <div class="kadi-shell flex min-h-dvh flex-col items-center justify-center gap-3 text-white">
        <BrandMark />
        <p class="kadi-label">Dealing the table…</p>
      </div>
    );
  }

  if (screen === "home") {
    return (
      <>
        <Toast message={toast} />
        <HomeScreen
          stats={stats}
          history={history}
          numBots={numBots}
          resumable={resumable}
          onPlay={() => setScreen("lobby")}
          onSelectMode={(bots) => {
            setNumBots(bots);
            setScreen("lobby");
            haptics.tap();
          }}
          onContinue={() => {
            if (resumable) restoreSave(resumable);
          }}
          onHowTo={() => setScreen("howto")}
          onSettings={() => openSettings("home")}
          onViewGames={() => setScreen("games")}
          onCreateRoom={() => setChallengeOpen(true)}
        />
        {challengeOpen && (
          <ChallengeFriendsModal
            onClose={() => setChallengeOpen(false)}
            onPlay={() => {
              setChallengeOpen(false);
              setScreen("lobby");
            }}
          />
        )}
      </>
    );
  }

  if (screen === "games") {
    return <MyGamesScreen history={history} onBack={() => setScreen("home")} onPlay={() => setScreen("lobby")} />;
  }

  if (screen === "lobby") {
    return (
      <LobbyScreen
        numBots={numBots}
        presetName={preset.name}
        customs={customs}
        jokersOn={jokersOn}
        onSelectBots={(bots) => {
          setNumBots(bots);
          haptics.tap();
        }}
        onToggleJokers={() => {
          savePatch({ jokersEnabled: !jokersOn });
          haptics.tap();
        }}
        onSelectPreset={(name) => {
          savePatch({ presetName: name });
          haptics.tap();
        }}
        onEditCustom={(custom) => {
          setBuilderInit({
            initial: { ...custom },
            sourceName: custom.name,
            editingName: custom.name,
          });
          setScreen("rules");
          haptics.tap();
        }}
        onNewCustom={() => {
          setBuilderInit({
            initial: { ...STANDARD_MAUA },
            sourceName: `Cloned from ${STANDARD_MAUA.name}`,
            editingName: null,
          });
          setScreen("rules");
          haptics.tap();
        }}
        onDeal={startGame}
        onBack={() => setScreen("home")}
        onSettings={() => openSettings("home")}
      />
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
            jokersEnabled: jokersOn,
            haptics: hapticsOn,
            animations: animationsOn,
          }}
          stats={stats}
          hasSave={settingsOrigin === "home" && resumable !== null}
          isCustom={isCustomActive}
          onNewCustom={openBuilderNew}
          onEditCustom={openBuilderEdit}
          onBack={() => setScreen(settingsOrigin)}
          onSave={(patch) => {
            savePatch(patch);
            haptics.tap();
          }}
          onClearHistory={() => {
            void store.clearMatchHistory().then(() => {
              setHistory([]);
              flash("Match history cleared");
            });
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
          onClearCustoms={() => {
            void store.clearAllCustomRules().then(() => {
              setCustoms([]);
              customsRef.current = [];
              flash("Custom rules cleared 🗑");
            });
          }}
        />
      </div>
    );
  }

  // ---- custom table rules builder (home/settings only, never mid-match) ----
  if (screen === "rules" && builderInit) {
    return (
      <div>
        <Toast message={toast} />
        <RulesBuilder
          initial={builderInit.initial}
          sourceName={builderInit.sourceName}
          editingName={builderInit.editingName}
          customNames={customs.map((c) => c.name)}
          onBack={() => setScreen("settings")}
          onSave={saveCustomProfile}
          onDelete={deleteCustomProfile}
        />
      </div>
    );
  }

  // ---- how to play (pre-game guide, no match state touched) ----
  if (screen === "howto") {
    return <HowToScreen onBack={() => setScreen("home")} />;
  }

  // ---- game screen ----
  if (!state) {
    return (
      <div class="kadi-shell flex min-h-dvh items-center justify-center text-white">
        <button
          type="button"
          onClick={startGame}
          class="kadi-gold-button rounded-2xl px-6 py-3 font-black"
        >
          Start
        </button>
      </div>
    );
  }

  const top = topCard(state);
  const myHand = state.hands[0];
  const myTurn = state.currentPlayer === 0 && !state.gameOver;
  // Buzzer is always live and clickable while the game runs, even with an
  // unwinnable hand or on a bot's turn. Shouting early is the player's risk:
  // a press without a legally winnable hand is fined immediately (no flag
  // set, so the win stays impossible until a proper declaration).
  const kadiHot = shouldDeclareKadi(state, 0);
  // Late cue: this turn's window expired unpressed, but the hand is still
  // ready, shouting now still declares, at the delay fine.
  const kadiLate =
    !state.kadiCalls[0] &&
    myHand.length > 0 &&
    kadiWindowRef.current.turn === state.turnNumber &&
    kadiWindowRef.current.missed;
  const kadiTitle = state.kadiCalls[0]
    ? "KADI already called, go out and finish!"
    : myHand.length === 0
      ? "Cardless, nothing to declare with"
      : kadiHot && kadiLate
        ? `Late KADI, still counts, but fined +${state.config.kadiDelayPickCount ?? 1}`
        : kadiHot
          ? "Niko Kadi! Press to declare"
          : `Say KADI anytime, a wrong call is fined +${state.config.falseKadiPickCount} on the spot`;
  const selectedCards = selected.flatMap(
    (id) => myHand.find((c) => c.id === id) ?? [],
  );
  const selectedOrder = new Map(selected.map((id, i) => [id, i + 1]));
  const validation =
    selectedCards.length > 0 ? validateCombo(selectedCards, state, 0) : null;
  // An illegal selection disables Play upfront, no tap needed to find out.
  const selectionInvalid = validation != null && !validation.ok;
  const selectionReason = selectionInvalid
    ? reasonText(
        validation.reason ?? null,
        state.activeSuit,
        state.pendingPenalty > 0 && topCard(state).rank === "JOKER",
        selectedCards.some((c) => c.rank === "JOKER"),
      )
    : null;

  const toggleSelect = (card: Card) => {
    if (!myTurn || busy) {
      pushNotice(
        state.gameOver ? "Game over" : "Wait for your turn…",
        state.turnNumber,
      );
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
      // The reason is already shown inline + in the coach line, no toast: the
      // feed (strict fine) is the only panel entry.
      const fined = resolveWrongPlay(state, 0);
      if (fined > 0) {
        pushFeed(describeWrongPlay("You", cards, fined, state.turnNumber));
        setSelected([]);
        setSuitPickerFor(null);
        setSuperPickerFor(null);
      }
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
      // Narrated by the describePlay fined event above, no toast.
      sfx.penalty();
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
    // Answering a penalty with aces is a pure block, no suit/super picker.
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
      pushNotice("KADI already called, go out and finish!", state.turnNumber);
      return;
    }
    if (myHand.length === 0) {
      pushNotice("Cardless, nothing to declare with.", state.turnNumber);
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
      pushFeed(describeDelayKadi("You", fined, state.turnNumber));
      pushFeed(describeKadi("You", state.turnNumber));
      sfx.penalty();
      haptics.penalty();
      bump();
      return;
    }
    const r = tryDeclareKadi(state, 0);
    if (r.ok) {
      sfx.kadi();
      haptics.play();
      pushFeed(describeKadi("You", state.turnNumber));
      bump();
    } else if (r.falseCall && r.fined) {
      sfx.penalty();
      haptics.penalty();
      pushFeed(describeFalseKadi("You", r.fined, state.turnNumber));
      bump();
    } else if (r.falseCall) {
      sfx.error();
      pushNotice("False KADI, no winnable hand.", state.turnNumber);
      bump();
    }
  };

  const waitingOn =
    BOT_NAMES[(state.currentPlayer - 1 + BOT_NAMES.length) % BOT_NAMES.length];
  const coachMsg = turnCoach({
    gameOver: state.gameOver,
    winner:
      state.winnerIndex == null
        ? null
        : state.winnerIndex === 0
          ? "You"
          : BOT_NAMES[
              (state.winnerIndex - 1 + BOT_NAMES.length) % BOT_NAMES.length
            ],
    myTurn,
    waitingOn,
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
        ? reasonText(
            validation.reason ?? null,
            state.activeSuit,
            state.pendingPenalty > 0 && topCard(state).rank === "JOKER",
            selectedCards.some((c) => c.rank === "JOKER"),
          )
        : null,
    legalCount: hints.size,
    kadiReady: canDeclareKadi(state, 0) && shouldDeclareKadi(state, 0),
  });
  const turnLine = state.gameOver
    ? "Game over"
    : myTurn
      ? "👉 Your turn"
      : `Waiting on ${waitingOn}…`;

  return (
    <div class="kadi-shell relative flex h-dvh flex-col overflow-hidden text-white safe-top safe-bottom">
      <PageBackdrop />
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

      <div class="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* top bar */}
          <div
            class="flex shrink-0 items-center justify-between gap-3 px-3 pt-2 md:px-6 md:pt-3"
            data-testid="game-topbar"
          >
            <div class="flex min-w-0 items-center gap-2.5">
              <BrandMark compact />
              <span class="hidden h-6 w-px bg-white/10 sm:block" />
              <div class="hidden items-center gap-1.5 sm:flex">
                <Pill>{state.hands.length}P</Pill>
                <Pill>
                  {state.direction === 1 ? "↻ clockwise" : "↺ anti-clockwise"}
                </Pill>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              {threats.some(Boolean) && <Pill tone="amber">KADI!</Pill>}
              <button
                type="button"
                onClick={() => setConfirmQuit(true)}
                aria-label="Quit"
                class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/5 hover:text-white"
              >
                <Icon name="pause" class="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Open settings"
                onClick={() => openSettings("game")}
                class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/5 hover:text-white"
              >
                <Icon name="settings" class="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* table */}
          <div
            class="flex min-h-0 min-w-0 flex-1 flex-col px-2.5 pb-2 md:px-5 md:pb-3"
            data-testid="game-table"
          >
            {/* bots */}
            <div class="flex shrink-0 justify-center gap-2 pt-2 md:gap-3">
              {state.hands.map((hand, i) => {
                if (i === 0) return null;
                const slot: "left" | "top" | "right" =
                  i === 1 ? "left" : i === 2 ? "top" : "right";
                const isTurn = state.currentPlayer === i && !state.gameOver;
                return (
                  <OpponentSeat
                    key={i}
                    name={BOT_NAMES[(i - 1) % BOT_NAMES.length]}
                    cards={hand.length}
                    isTurn={isTurn}
                    thinking={isTurn && busy}
                    kadi={Boolean(state.kadiCalls[i] && threats[i])}
                    slot={slot}
                    className="lg:max-w-[13rem]"
                  />
                );
              })}
            </div>

            {/* center felt */}
            <div class="relative mt-2 flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-kadi-line/35 bg-[radial-gradient(ellipse_at_center,rgba(20,74,53,0.55),rgba(4,22,16,0.3)_68%)] px-3 py-3 md:mt-3 md:px-6 md:py-4">
              <div class="pointer-events-none absolute inset-3 rounded-[1.6rem] border border-white/4" />
              <div class="relative flex items-center justify-center gap-6 md:gap-9">
                <button
                  type="button"
                  onClick={onPickPress}
                  class="flex flex-col items-center gap-2 rounded-xl transition hover:bg-white/5 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  disabled={!myTurn}
                  aria-label={`Pick a card (${state.drawPile.length} left)`}
                  data-testid="draw-pile"
                >
                  <div
                    class={`flex w-[4.5rem] flex-col items-center justify-center rounded-xl border ${
                      myTurn
                        ? "border-kadi-gold/70 bg-kadi-gold/5 shadow-[0_0_24px_rgba(245,197,24,0.1)]"
                        : "border-kadi-line/50 bg-black/20"
                    } py-2 md:w-24 md:py-3`}
                  >
                    <CardView
                      card={{ id: "draw-back", rank: "A", suit: "spades" }}
                      faceDown
                    />
                    <span class="mt-1.5 text-[10px] font-bold text-white/65 md:text-[11px]">
                      {state.drawPile.length} left
                    </span>
                    <span
                      class={`text-[9px] font-black tracking-widest md:text-[10px] ${
                        myTurn ? "text-kadi-gold" : "text-white/25"
                      }`}
                    >
                      {myTurn ? "PICK" : "DECK"}
                    </span>
                  </div>
                </button>
                <div
                  class="anim-fly-in flex flex-col items-center gap-1.5"
                  key={top.id + String(state.discardPile.length)}
                >
                  <CardView card={top} large />
                  <div class="flex min-h-6 flex-wrap justify-center gap-1">
                    {state.pendingPenalty > 0 && (
                      <Pill tone="red">Pick {state.pendingPenalty}</Pill>
                    )}
                    {state.pendingSkip > 0 && (
                      <Pill tone="amber">SKIP ×{state.pendingSkip}</Pill>
                    )}
                    {(state.pendingReverse ?? 0) > 0 && (
                      <Pill tone="amber">
                        REVERSE ×{state.pendingReverse}
                      </Pill>
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

              <div class="relative mt-3 w-full max-w-xl xl:hidden">
                <EventBanner events={feed} />
              </div>
              <div
                class="relative mt-1.5 w-full max-w-xl"
                aria-live="polite"
              >
                {coachOn ? (
                  <CoachBar msg={coachMsg} />
                ) : (
                  <p
                    class={`mb-1 text-center text-xs font-bold ${
                      myTurn && !state.gameOver
                        ? "text-kadi-gold"
                        : "text-white/50"
                    }`}
                  >
                    {turnLine}
                  </p>
                )}
              </div>
            </div>

            {/* bottom rail: buzzer / hand / actions */}
          <div class="flex min-w-0 shrink-0 flex-col justify-end px-1 pb-1 pt-1 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end lg:gap-8 lg:px-0 lg:pb-0 [@media(max-height:520px)]:pb-0 [@media(max-height:520px)]:pt-0">
            {!state.gameOver && (
              <div class="flex shrink-0 flex-col items-center justify-center py-2 lg:order-2 lg:w-40 lg:justify-self-center lg:pb-3 [@media(max-height:520px)]:py-0">
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
                  <p class="mb-1 text-center text-[11px] font-bold uppercase tracking-widest text-amber-300">
                    Late shout costs +1, but it counts
                  </p>
                )}
                <KadiBuzzer
                  urgent={kadiHot}
                  title={kadiTitle}
                  onPress={onKadi}
                />
              </div>
            )}

            <div class="flex min-w-0 flex-col items-center lg:order-1">
              <div
                class="flex w-full min-w-0 shrink-0 overflow-x-auto no-scrollbar pt-3 [@media(max-height:520px)]:pt-1"
                data-testid="hand"
              >
                <div
                  class="mx-auto flex w-max"
                  style={{ paddingLeft: 8, paddingRight: 8 }}
                >
                  {myHand.map((c) => (
                    <div
                      key={c.id}
                      class="-ml-4 first:ml-0 md:-ml-3 lg:-ml-4"
                    >
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

            <div
              class="mt-3 shrink-0 lg:order-3 lg:mt-0 lg:w-44 lg:justify-self-end [@media(max-height:520px)]:mt-1"
              data-testid="actions"
            >
              {selectionInvalid && (
                <p class="pb-1 text-center text-[11px] font-bold text-red-300">
                  ⛔ {selectionReason}
                </p>
              )}
              <div class="flex items-center gap-2 lg:flex-col-reverse lg:items-stretch">
                <button
                  type="button"
                  onClick={onPickPress}
                  disabled={!myTurn}
                  data-testid="pick-button"
                  class="kadi-ghost-button flex-1 rounded-2xl py-3.5 text-sm font-bold disabled:opacity-40 active:scale-95 lg:w-full lg:flex-none lg:py-4 lg:text-base [@media(max-height:520px)]:py-2"
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
                  data-testid="play-button"
                  class={`flex-1 rounded-2xl py-3.5 text-sm font-black transition active:scale-95 disabled:opacity-40 lg:w-full lg:flex-none lg:py-4 lg:text-base [@media(max-height:520px)]:py-2 ${
                    selectionInvalid
                      ? strictOn
                        ? "bg-red-500 text-white"
                        : "bg-red-500/40 text-white/60"
                      : "kadi-gold-button"
                  }`}
                >
                  Play{selectedCards.length > 0 ? ` ${selectedCards.length}` : ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* match log rail */}
      <aside
        class="hidden xl:flex xl:w-80 xl:shrink-0 xl:flex-col xl:gap-3 xl:border-l xl:border-white/8 xl:bg-kadi-ink/45 xl:p-4 xl:backdrop-blur-sm"
        data-testid="feed-rail"
      >
        <StatsCard stats={stats} />
        <div class="min-h-0 flex-1">
          <EventBanner events={feed} variant="panel" />
        </div>
      </aside>
      </div>

      {/* game over */}
      {state.gameOver && (
        <div class="fixed inset-0 z-40 flex items-end justify-center bg-kadi-ink/80 p-4 backdrop-blur-sm sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-over-title"
            data-testid="game-over"
            class="kadi-panel-strong anim-fanfare w-full max-w-sm rounded-3xl p-6 text-center"
          >
            <div class="text-5xl">{state.winnerIndex === 0 ? "🏆" : "😅"}</div>
            <h3
              id="game-over-title"
              class="mt-2 text-2xl font-black text-kadi-gold"
            >
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
              class="kadi-gold-button mt-5 w-full rounded-2xl py-3.5 font-black"
            >
              Rematch
            </button>
            <button
              type="button"
              onClick={() => quitToHome(true)}
              class="kadi-ghost-button mt-2 w-full rounded-2xl py-3 text-sm font-bold"
            >
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
