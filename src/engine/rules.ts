import type { Rank, Suit } from './cards';

/**
 * Rules as DATA — the engine never hardcodes card meanings.
 * Add a field + default to support a new house rule without breaking old profiles.
 */
export interface RulesConfig {
  version: number;
  /** Display name for presets / custom profiles */
  name: string;
  /** Cards dealt to each player at start */
  dealCount: number;
  jokersEnabled: boolean;
  /** Penalty pick counts, e.g. { '2': 2, '3': 3, 'JOKER': 5 } */
  penaltyPicks: Partial<Record<'2' | '3' | 'JOKER', number>>;
  /** Gate: a pending penalty may be answered with a matching penalty card (else pick or Ace-block). */
  allowPenaltyStacking: boolean;
  /** Debts accumulate across stacks (true: eater picks the total) or the latest penalty replaces (false: top takes over). */
  penaltyAccumulates: boolean;
  /**
   * How a penalty card answers a pending penalty:
   * - 'family' (default): a Joker answers any 2/3; a Joker on top is relaxed
   *   only by another Joker or an Ace; 2/3 on 2/3: same rank any suit, or
   *   same suit any penalty rank.
   * - 'sameRank': only the same rank answers (2-on-2, 3-on-3, JOKER-on-JOKER).
   * - 'any' (Bom ni Bom): any penalty answers any other, regardless of rank/suit.
   */
  penaltyMatchMode: 'family' | 'sameRank' | 'any';
  /**
   * Bom ni Bom dodge: while a penalty is pending, a single J (jump) or K
   * (kickback) may be played to pass the unchanged debt onward. J/K stay
   * jump/reverse cards — they never count as penalties and never add picks.
   */
  dodgePenaltyWithJumpKickback: boolean;
  /** Ace played on a penalty clears it (block). */
  aceBlocksPenalty: boolean;
  /** Ace declares the next suit (request). */
  aceCallsSuit: boolean;
  jumpRanks: Rank[];
  jumpCounterable: boolean;
  kickbackRanks: Rank[];
  kickbackCounterable: boolean;
  questionRanks: Rank[];
  /** Stacked questions (Q/8) are closed by a same-suit winning answer — or by any Ace. */
  mustAnswerSameSuit: boolean;
  /** An Ace answers any open question regardless of suit (Q♠ + A♦ is legal). Future custom mode may turn this off. */
  aceAnswersQuestion: boolean;
  /** Asking a question without an answer is legal but draws this many cards. */
  unansweredQuestionPickCount: number;
  /** Ranks that alone can finish a game. */
  winningRanks: Rank[];
  mustSayNikoKadi: boolean;
  cardlessBlocksWin: boolean;
  /** Ranks that may never open the discard pile. */
  starterBlacklist: Rank[];
  /** With exactly 2 players, J behaves like a Question (needs answer) instead of skip. */
  twoPlayerJumpAsQuestion: boolean;
  /** With exactly 2 players, K behaves like a Question (needs answer) instead of reverse. */
  twoPlayerKickbackAsQuestion: boolean;
  /** Penalty for playing an illegal card. */
  invalidPlayPickCount: number;
  /** Strict tables: submitting an illegal combo draws the fine and passes the turn. */
  strictWrongPlay: boolean;
  /** Going out clean without a valid prior Kadi call: win denied, draw this many. */
  lateCallPickCount: number;
  /** Calling Kadi without a legally winnable hand: call rejected, draw this many. */
  falseKadiPickCount: number;
  /** Letting the 2s KADI call-window expire: draw this many. */
  kadiDelayPickCount: number;
  /** Super-ace mode (lobby toggle): the special ace ALONE can demand an exact card. */
  superAceEnabled: boolean;
  /** The inherently "special" ace when superAceEnabled (usually spades). */
  specialAceSuit: Suit;
  /** Stacked aces reaching this count are always super (exact-card demand), mode or not. */
  superAceMinAces: number;
  /** Cards drawn when a player cannot meet an exact-card request. */
  unmetRequestPickCount: number;
}

export const STANDARD_MAUA: RulesConfig = {
  version: 2,
  name: 'Standard Maua',
  dealCount: 4,
  jokersEnabled: true,
  penaltyPicks: { '2': 2, '3': 3, 'JOKER': 5 },
  allowPenaltyStacking: true,
  penaltyAccumulates: false,
  penaltyMatchMode: 'family',
  dodgePenaltyWithJumpKickback: false,
  aceBlocksPenalty: true,
  aceCallsSuit: true,
  jumpRanks: ['J'],
  jumpCounterable: true,
  kickbackRanks: ['K'],
  kickbackCounterable: true,
  questionRanks: ['Q', '8'],
  mustAnswerSameSuit: true,
  aceAnswersQuestion: true,
  unansweredQuestionPickCount: 1,
  winningRanks: ['4', '5', '6', '7', '9', '10'],
  mustSayNikoKadi: true,
  cardlessBlocksWin: true,
  starterBlacklist: ['2', '3', 'J', 'Q', '8', 'K', 'A', 'JOKER'],
  twoPlayerJumpAsQuestion: false,
  twoPlayerKickbackAsQuestion: false,
  invalidPlayPickCount: 1,
  strictWrongPlay: false,
  lateCallPickCount: 1,
  falseKadiPickCount: 1,
  kadiDelayPickCount: 1,
  superAceEnabled: false,
  specialAceSuit: 'spades',
  superAceMinAces: 2,
  unmetRequestPickCount: 1,
};

export const STRICT_NO_JOKER: RulesConfig = {
  ...STANDARD_MAUA,
  name: 'Strict No-Joker',
  jokersEnabled: false,
  penaltyPicks: { '2': 2, '3': 3 },
};

export const BOM_NI_BOM: RulesConfig = {
  ...STANDARD_MAUA,
  name: 'Bom ni Bom',
  penaltyMatchMode: 'any',
  dodgePenaltyWithJumpKickback: true,
  penaltyAccumulates: true,
};

/**
 * Backstreet Pesa — the money-game table. Country-wide common rules because
 * cash is on the line: penalties accumulate (eater picks the total) and the
 * table is strict (illegal taps are fined + turn passes, no free passes).
 * Same-suit question answers, hard Niko Kadi call fines and the cardless
 * block all carry over from Standard.
 */
export const BACKSTREET_PESA: RulesConfig = {
  ...STANDARD_MAUA,
  name: 'Backstreet Pesa',
  penaltyAccumulates: true,
  strictWrongPlay: true,
};

export const PRESETS: RulesConfig[] = [STANDARD_MAUA, BOM_NI_BOM, BACKSTREET_PESA, STRICT_NO_JOKER];

/** Migrate any stored config to current version (forward-compatible). */
export function migrateRules(input: Partial<RulesConfig> & { version?: number }): RulesConfig {
  return { ...STANDARD_MAUA, ...input, version: 2, name: input.name ?? 'Custom' };
}

export function isPenaltyRank(rank: Rank, config: RulesConfig): boolean {
  return (rank === '2' || rank === '3' || rank === 'JOKER') && config.penaltyPicks[rank] != null;
}

export function isJumpRank(rank: Rank, config: RulesConfig): boolean {
  return config.jumpRanks.includes(rank);
}

export function isKickbackRank(rank: Rank, config: RulesConfig): boolean {
  return config.kickbackRanks.includes(rank);
}

export function isQuestionRank(rank: Rank, config: RulesConfig): boolean {
  return config.questionRanks.includes(rank);
}

export function isWinningRank(rank: Rank, config: RulesConfig): boolean {
  return config.winningRanks.includes(rank);
}
