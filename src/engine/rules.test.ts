import { describe, expect, it } from 'vitest';
import {
  BACKSTREET_PESA,
  BOM_NI_BOM,
  STANDARD_MAUA,
  STRICT_NO_JOKER,
  decodeRulesConfig,
  describeRules,
  encodeRulesConfig,
  migrateRules,
  validateRulesConfig,
} from './rules';

describe('validateRulesConfig', () => {
  it('accepts every built-in preset', () => {
    for (const p of [STANDARD_MAUA, STRICT_NO_JOKER, BOM_NI_BOM, BACKSTREET_PESA]) {
      expect(validateRulesConfig(p)).toEqual([]);
    }
  });

  it('rejects unplayable profiles with plain reasons', () => {
    expect(validateRulesConfig({ ...STANDARD_MAUA, name: '  ' }).length).toBeGreaterThan(0);
    expect(
      validateRulesConfig({ ...STANDARD_MAUA, name: 'X', winningRanks: [] })[0],
    ).toMatch(/finish/);
    expect(
      validateRulesConfig({ ...STANDARD_MAUA, name: 'X', penaltyPicks: {} })[0],
    ).toMatch(/penalty/);
    expect(
      validateRulesConfig({ ...STANDARD_MAUA, name: 'X', penaltyPicks: { '2': 0 } })[0],
    ).toMatch(/at least 1/);
    expect(
      validateRulesConfig({ ...STANDARD_MAUA, name: 'X', superAceMinAces: 1 })[0],
    ).toMatch(/at least 2/);
    expect(
      validateRulesConfig({ ...STANDARD_MAUA, name: 'X', dealCount: 9 })[0],
    ).toMatch(/2–7/);
    expect(
      validateRulesConfig({ ...STANDARD_MAUA, name: 'X', lateCallPickCount: -1 })[0],
    ).toMatch(/cannot be negative/);
  });
});

describe('share codec', () => {
  it('round-trips a custom profile through encode/decode', () => {
    const custom = migrateRules({
      name: 'Estate Sunday',
      penaltyMatchMode: 'any',
      dodgePenaltyWithJumpKickback: true,
      penaltyAccumulates: true,
      winningDumpMustBeSingle: true,
      jokersEnabled: false,
      penaltyPicks: { '2': 2, '3': 3 },
    });
    const code = encodeRulesConfig(custom);
    expect(code.startsWith('kadi2.')).toBe(true);
    expect(decodeRulesConfig(code)).toMatchObject({
      name: 'Estate Sunday',
      penaltyMatchMode: 'any',
      dodgePenaltyWithJumpKickback: true,
      winningDumpMustBeSingle: true,
      jokersEnabled: false,
    });
  });

  it('rejects garbage with plain errors', () => {
    expect(() => decodeRulesConfig('hello')).toThrow(/share code/);
    expect(() => decodeRulesConfig('kadi2.!!!not-base64!!!')).toThrow(/corrupted/);
    expect(() => decodeRulesConfig(encodeRulesConfig({ ...STANDARD_MAUA, name: 'X', winningRanks: [] }))).toThrow(
      /not playable/,
    );
  });
});

describe('describeRules', () => {
  it('names the ways a table differs', () => {
    expect(describeRules(BOM_NI_BOM)).toMatch(/Bom stacking/);
    expect(describeRules(BOM_NI_BOM)).toMatch(/J\/K dodge/);
    expect(describeRules(BACKSTREET_PESA)).toMatch(/Strict/);
    expect(describeRules(STRICT_NO_JOKER)).toMatch(/No jokers/);
    expect(describeRules({ ...STANDARD_MAUA, winningDumpMustBeSingle: true })).toMatch(
      /One-card finish/,
    );
  });
});

describe('migration fills the new fields', () => {
  it('v1 saves land on playable v2 defaults', () => {
    const m = migrateRules({ version: 1, name: 'Old Estate' });
    expect(m.version).toBe(2);
    expect(m.penaltyMatchMode).toBe('family');
    expect(m.dodgePenaltyWithJumpKickback).toBe(false);
    expect(m.winningDumpMustBeSingle).toBe(false);
    expect(validateRulesConfig(m)).toEqual([]);
  });
});
