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
  /** Must say Niko Kadi on an earlier turn to win. */
  mustSayNikoKadi: boolean;
  /** Someone cardless at the table blocks every win. */
  cardlessBlocksWin: boolean;
  /**
   * Must-end-on-one: only a lone single card can close a game. Multi-card
   * dumps can shed down to one card but never win outright — engineer your
   * hand to a single finisher and play it alone.
   */
  winningDumpMustBeSingle: boolean;
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
  winningDumpMustBeSingle: false,
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

/**
 * Guardrails for hand-built profiles (builder UI + share-code imports).
 * Returns human-readable problems; empty means the profile is playable.
 */
export function validateRulesConfig(c: RulesConfig): string[] {
  const problems: string[] = [];
  if (!c.name || c.name.trim() === '') problems.push('Give the profile a name.');
  if (c.winningRanks.length === 0) problems.push('Pick at least one rank that can finish.');
  const picks = c.penaltyPicks;
  if (picks['2'] == null && picks['3'] == null && picks['JOKER'] == null) {
    problems.push('Keep at least one penalty card (2, 3 or Joker) active.');
  }
  for (const r of ['2', '3', 'JOKER'] as const) {
    const n = picks[r];
    if (n != null && !(n >= 1)) problems.push(`Pick count for ${r} must be at least 1.`);
  }
  if (!(c.superAceMinAces >= 2)) problems.push('Stacked super aces need at least 2.');
  if (!(c.dealCount >= 2 && c.dealCount <= 7)) problems.push('Deal 2–7 cards each.');
  const fines: [string, number][] = [
    ['unanswered question', c.unansweredQuestionPickCount],
    ['late Niko Kadi call', c.lateCallPickCount],
    ['false Kadi call', c.falseKadiPickCount],
    ['slow Kadi call', c.kadiDelayPickCount],
    ['illegal play', c.invalidPlayPickCount],
    ['unmet exact demand', c.unmetRequestPickCount],
  ];
  for (const [label, n] of fines) {
    if (!(n >= 0)) problems.push(`Fine for ${label} cannot be negative.`);
  }
  return problems;
}

/** Prefix for offline share codes: `kadi2.` + base64url(JSON). */
export const SHARE_CODE_PREFIX = 'kadi2.';

/** Pack a profile into a copy-paste share code (offline, clipboard only). */
export function encodeRulesConfig(c: RulesConfig): string {
  const json = JSON.stringify(migrateRules({ ...c }));
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return (
    SHARE_CODE_PREFIX +
    btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  );
}

/** Unpack a share code back into a validated profile. Throws on any problem. */
export function decodeRulesConfig(code: string): RulesConfig {
  const trimmed = code.trim();
  if (!trimmed.startsWith(SHARE_CODE_PREFIX)) {
    throw new Error(`Not a Kadi share code — it should start with ${SHARE_CODE_PREFIX}`);
  }
  const b64 = trimmed
    .slice(SHARE_CODE_PREFIX.length)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  let json: string;
  try {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    json = new TextDecoder().decode(bytes);
  } catch {
    throw new Error('Share code is corrupted — ask for a fresh copy.');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Share code is corrupted — ask for a fresh copy.');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Share code is corrupted — ask for a fresh copy.');
  }
  const rec = raw as Record<string, unknown>;
  const name = typeof rec['name'] === 'string' && rec['name'].trim() !== '' ? rec['name'] : 'Shared table';
  const migrated = migrateRules({ ...(raw as Partial<RulesConfig>), name });
  const problems = validateRulesConfig(migrated);
  if (problems.length > 0) throw new Error(`Shared rules are not playable: ${problems[0]}`);
  return migrated;
}

/** One-line card for preset/custom pickers: the ways this table differs. */
export function describeRules(c: RulesConfig): string {
  const bits: string[] = [];
  if (c.penaltyMatchMode === 'any') bits.push('Bom stacking');
  else if (c.penaltyMatchMode === 'sameRank') bits.push('Same-rank stacks');
  if (c.dodgePenaltyWithJumpKickback) bits.push('J/K dodge');
  bits.push(c.penaltyAccumulates ? 'Eats all' : 'Top takes over');
  if (c.superAceEnabled) bits.push('Babu');
  bits.push(c.jokersEnabled ? 'Jokers' : 'No jokers');
  if (c.winningDumpMustBeSingle) bits.push('One-card finish');
  if (!c.mustSayNikoKadi) bits.push('Silent finish');
  if (!c.cardlessBlocksWin) bits.push('No cardless block');
  if (c.strictWrongPlay) bits.push('Strict');
  bits.push(`${c.dealCount} cards each`);
  return bits.join(' • ');
}
