import type { Card, Rank, Suit } from "../engine/cards";
import { createGame, type GameState } from "../engine/state";

/** One card in a practice board. Ids are stable so solutions match by id. */
export interface CardSpec {
  rank: Rank;
  suit: Suit;
  id: string;
}

export function cs(rank: Rank, suit: Suit): CardSpec {
  return { rank, suit, id: `${rank}-${suit}` };
}

export interface BoardSetup {
  top: CardSpec;
  hand: CardSpec[];
  pendingPenalty?: number;
  pendingSkip?: number;
  request?: { rank: Rank; suit: Suit };
  kadiDeclared?: boolean;
}

export type BoardExpect = "win" | "cardless" | "fined";

export interface PlayBoard {
  kind: "play";
  id: string;
  prompt: string;
  setup: BoardSetup;
  /** Ordered id sequences that pass the lesson. */
  solutions: string[][];
  winText: string;
  /** Shown when the move is legal but not the lesson (e.g. a bare Q). */
  almostText?: string;
  /** Documented wrong taps, verified against the engine in tests. */
  wrongs: { cards: string[]; reason: string }[];
  /** Full-move outcome checked via playCombo on a clone. */
  expect?: BoardExpect;
  /** Optional fallback button (e.g. eating a penalty): label + success line. */
  kula?: { label: string; winText: string };
}

export interface ChoiceBoard {
  kind: "choice";
  id: string;
  prompt: string;
  hand: CardSpec[];
  options: { label: string; correct: boolean; feedback: string }[];
}

export type Board = PlayBoard | ChoiceBoard;

/**
 * A real table for practice: 2 seats, Standard Maua, deterministic deck.
 * Overridden with the board's top/hand/debts so validateCombo and playCombo
 * behave exactly like a live match. Opponent always holds cards so a win
 * is never blocked as cardless, and the draw pile stays stocked for fines.
 */
export function buildPracticeTable(setup: BoardSetup): GameState {
  const s = createGame({ numPlayers: 2, random: () => 0.5 });
  const toCard = (c: CardSpec): Card => ({ id: c.id, rank: c.rank, suit: c.suit });
  s.discardPile = [toCard(setup.top)];
  s.hands = [
    setup.hand.map(toCard),
    [
      { id: "bot-1", rank: "4", suit: "clubs" },
      { id: "bot-2", rank: "6", suit: "diamonds" },
    ],
  ];
  s.currentPlayer = 0;
  s.pendingPenalty = setup.pendingPenalty ?? 0;
  s.pendingPenaltyRank = (setup.pendingPenalty ?? 0) > 0 ? "2" : null;
  s.pendingSkip = setup.pendingSkip ?? 0;
  s.activeCardRequest = setup.request ? { ...setup.request } : null;
  if (setup.kadiDeclared) s.kadiCalls = [true, false];
  return s;
}

/** Resolve tapped ids to the live cards in a practice table. */
export function tableCards(state: GameState, ids: string[]): Card[] {
  return ids.flatMap((id) => state.hands[0].find((c) => c.id === id) ?? []);
}

export const PLAY_BOARDS: PlayBoard[] = [
  {
    kind: "play",
    id: "goal-pick-winner",
    prompt: "Top is 4♣. Finishers are 4 5 6 7 9 10 — play one.",
    setup: { top: cs("4", "clubs"), hand: [cs("9", "diamonds"), cs("5", "clubs")] },
    solutions: [["5-clubs"]],
    winText: "Sawa! 5 closes games. 4 5 6 7 9 10 are finishers.",
    wrongs: [{ cards: ["9-diamonds"], reason: "NO_MATCH" }],
  },
  {
    kind: "play",
    id: "match-one",
    prompt: "Top is 9♥. Play a card that matches suit or rank.",
    setup: { top: cs("9", "hearts"), hand: [cs("7", "spades"), cs("K", "hearts")] },
    solutions: [["K-hearts"]],
    winText: "Sawa! K♥ follows hearts.",
    wrongs: [{ cards: ["7-spades"], reason: "NO_MATCH" }],
  },
  {
    kind: "play",
    id: "combo-order",
    prompt: "Top is K♣. Dump both 7s — tap in order, first must match top.",
    setup: { top: cs("K", "clubs"), hand: [cs("7", "clubs"), cs("7", "hearts")] },
    solutions: [["7-clubs", "7-hearts"]],
    winText: "Sawa! 7♣ matches clubs, 7♥ chains by rank.",
    wrongs: [{ cards: ["7-hearts", "7-clubs"], reason: "NO_MATCH" }],
  },
  {
    kind: "play",
    id: "answer-question",
    prompt: "Top is 9♠. Ask with Q♠ — but close it in the same move.",
    setup: {
      top: cs("9", "spades"),
      hand: [cs("Q", "spades"), cs("5", "spades"), cs("A", "diamonds"), cs("7", "clubs")],
    },
    solutions: [
      ["Q-spades", "5-spades"],
      ["Q-spades", "A-diamonds"],
    ],
    winText: "Sawa! Same-suit 5♠ — or any Ace — closes the question.",
    almostText: "Legal, but a bare Q makes you kula +1. Add 5♠ or an Ace.",
    wrongs: [{ cards: ["7-clubs"], reason: "NO_MATCH" }],
  },
  {
    kind: "play",
    id: "jump-refuse",
    prompt: "You were rukad! Refuse with your J to keep your turn.",
    setup: {
      top: cs("J", "hearts"),
      hand: [cs("J", "spades"), cs("7", "hearts")],
      pendingSkip: 1,
    },
    solutions: [["J-spades"]],
    winText: "Sawa! One J refuses the jump — play on.",
    wrongs: [{ cards: ["7-hearts"], reason: "SKIP_MUST_COUNTER_OR_ACCEPT" }],
  },
  {
    kind: "play",
    id: "block-penalty",
    prompt: "Pick 2 hangs over you. Funga it with your Ace.",
    setup: {
      top: cs("2", "hearts"),
      hand: [cs("A", "clubs"), cs("7", "hearts")],
      pendingPenalty: 2,
    },
    solutions: [["A-clubs"]],
    winText: "Sawa! Ace fungas the +2 — no one picks, no suit called.",
    wrongs: [{ cards: ["7-hearts"], reason: "PENALTY_MUST_STACK_OR_BLOCK" }],
  },
  {
    kind: "play",
    id: "penalty-choice",
    prompt: "Pick 2 hangs over you (from 2♥). Answer it — or kula.",
    setup: {
      top: cs("2", "hearts"),
      hand: [cs("2", "spades"), cs("3", "hearts"), cs("7", "diamonds")],
      pendingPenalty: 2,
    },
    solutions: [["2-spades"], ["3-hearts"]],
    winText: "Sawa! Same rank or same suit answers — latest count stands.",
    wrongs: [{ cards: ["7-diamonds"], reason: "PENALTY_MUST_STACK_OR_BLOCK" }],
    kula: { label: "Kula +2", winText: "You kula +2. Next time you hold the answer, play it." },
  },
  {
    kind: "play",
    id: "babu-demand",
    prompt: "Babu demands 5♥ exactly. Bring it, play an Ace, or kula.",
    setup: {
      top: cs("A", "spades"),
      hand: [cs("5", "hearts"), cs("A", "diamonds"), cs("7", "clubs")],
      request: { rank: "5", suit: "hearts" },
    },
    solutions: [["5-hearts"], ["A-diamonds"]],
    winText: "Sawa! Exact card — or any Ace to lift the demand.",
    wrongs: [{ cards: ["7-clubs"], reason: "UNMET_REQUEST" }],
    kula: { label: "Kula +1", winText: "You kula +1. Demanding what you hold is unanswerable — remember that." },
  },
  {
    kind: "play",
    id: "win-clean",
    prompt: "You said Niko Kadi last turn. Dump both 5s and win.",
    setup: {
      top: cs("5", "hearts"),
      hand: [cs("5", "clubs"), cs("5", "diamonds")],
      kadiDeclared: true,
    },
    solutions: [["5-clubs", "5-diamonds"]],
    winText: "🏆 Clean finish on a 5 — Niko Kadi, you win!",
    expect: "win",
    wrongs: [],
  },
  {
    kind: "play",
    id: "win-bad-ending",
    prompt: "Two Js dump your hand — but can a J close a game? Try it.",
    setup: {
      top: cs("9", "clubs"),
      hand: [cs("J", "clubs"), cs("J", "hearts")],
      kadiDeclared: true,
    },
    solutions: [["J-clubs", "J-hearts"]],
    winText: "See? Hand empty, no win — J can't finish. You're cardless, play on.",
    expect: "cardless",
    wrongs: [],
  },
  {
    kind: "play",
    id: "win-no-call",
    prompt: "Dump both 5s with NO call first. What happens?",
    setup: {
      top: cs("5", "hearts"),
      hand: [cs("5", "clubs"), cs("5", "diamonds")],
    },
    solutions: [["5-clubs", "5-diamonds"]],
    winText: "No call, no win — fined +1. Shout Niko Kadi a turn earlier.",
    expect: "fined",
    wrongs: [],
  },
  {
    kind: "play",
    id: "win-ace-answer",
    prompt: "An Ace alone can't finish — but answering a question, it wins. Dump Q♠ + A♦.",
    setup: {
      top: cs("9", "spades"),
      hand: [cs("Q", "spades"), cs("A", "diamonds")],
      kadiDeclared: true,
    },
    solutions: [["Q-spades", "A-diamonds"]],
    winText: "🏆 Q + Ace wins ending on the Ace — the only way an Ace closes a game.",
    almostText: "Legal — but a lone Ace can't finish, and a bare Q makes you kula. Play Q♠ + A♦ together.",
    expect: "win",
    wrongs: [],
  },
];

export const CHOICE_BOARDS: ChoiceBoard[] = [
  {
    kind: "choice",
    id: "kadi-shout-now",
    prompt: "You hold 5♣ + 5♦ — both finishers. What now?",
    hand: [cs("5", "clubs"), cs("5", "diamonds")],
    options: [
      {
        label: "Shout Niko Kadi 📢",
        correct: true,
        feedback: "Sawa! Shout now, finish next turn.",
      },
      {
        label: "Dump both now",
        correct: false,
        feedback: "No call, no win — you'd kula +1. Shout first, finish next turn.",
      },
    ],
  },
  {
    kind: "choice",
    id: "kadi-too-early",
    prompt: "You hold J♣ + 5♦ — J can't finish. Shout?",
    hand: [cs("J", "clubs"), cs("5", "diamonds")],
    options: [
      {
        label: "Shout Niko Kadi 📢",
        correct: false,
        feedback: "Too early — no winnable hand, you'd kula +1. Keep playing.",
      },
      {
        label: "Keep playing",
        correct: true,
        feedback: "Sawa! Only shout when every card can dump clean.",
      },
    ],
  },
];
