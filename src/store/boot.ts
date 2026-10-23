import type { RulesConfig } from '../engine/rules';
import type { ActiveGameSave, GameStore, Settings } from './local';

export interface BootData {
  customs: RulesConfig[];
  settings: Settings | null;
  save: ActiveGameSave | null;
}

export async function loadBootData(
  store: Pick<GameStore, 'getCustomRules' | 'getSettings' | 'loadActiveGame'>,
): Promise<BootData> {
  let customs: RulesConfig[];
  try {
    customs = await store.getCustomRules();
  } catch {
    customs = [];
  }

  let settings: Settings | null;
  try {
    settings = await store.getSettings();
  } catch {
    settings = null;
  }

  let save: ActiveGameSave | null;
  try {
    save = await store.loadActiveGame();
  } catch {
    save = null;
  }

  return { customs, settings, save };
}
