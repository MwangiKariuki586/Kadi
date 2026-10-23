import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STANDARD_MAUA } from '../engine/rules';

const { memory } = vi.hoisted(() => ({ memory: new Map<string, unknown>() }));

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => memory.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    memory.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    memory.delete(key);
  }),
}));

const { LocalStore } = await import('./local');

beforeEach(() => {
  memory.clear();
});

describe('custom rule profiles', () => {
  it('renames a saved profile in place', async () => {
    const store = new LocalStore();
    await store.saveCustomRules({ ...STANDARD_MAUA, name: 'Old Table' });
    await store.saveCustomRules({ ...STANDARD_MAUA, name: 'Other Table' });

    const next = await store.saveCustomRules(
      { ...STANDARD_MAUA, name: 'New Table' },
      'Old Table',
    );

    expect(next.map((profile) => profile.name)).toEqual([
      'Other Table',
      'New Table',
    ]);
    await expect(store.getCustomRules()).resolves.toMatchObject([
      { name: 'Other Table' },
      { name: 'New Table' },
    ]);
  });
});
