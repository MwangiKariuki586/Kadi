import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './local';
import { motionAttribute } from '../ui/motion';

describe('settings defaults', () => {
  it('vibration and animations are on by default', () => {
    expect(DEFAULT_SETTINGS.haptics).toBe(true);
    expect(DEFAULT_SETTINGS.animations).toBe(true);
  });

  it('legacy presets still default casual (no strict, no babu)', () => {
    expect(DEFAULT_SETTINGS.strict).toBe(false);
    expect(DEFAULT_SETTINGS.superAce).toBe(false);
    expect(DEFAULT_SETTINGS.coach).toBe(false);
    expect(DEFAULT_SETTINGS.sound).toBe(true);
  });
});

describe('motion helper', () => {
  it('maps animations flag to data-motion values', () => {
    expect(motionAttribute(true)).toBe('full');
    expect(motionAttribute(false)).toBe('reduced');
  });
});
