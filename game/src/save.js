// Save and load: cash, mission progress, caches and the best haul, kept in
// localStorage between visits (this browser only). A save that fails to parse
// is ignored and the game starts fresh.

import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      missionIndex: state.missionIndex,
      missionsDone: state.stats.missionsDone,
      caches: state.caches.filter((c) => c.taken).length,
      busted: state.stats.busted,
      wasted: state.stats.wasted,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Apply a loaded save to a fresh world (caches stay taken, missions stay done). */
export function applySave(state, data) {
  state.cash = data.cash;
  state.missionIndex = Math.min(5, Math.max(0, data.missionIndex));
  state.stats.missionsDone = data.missionsDone || 0;
  state.stats.busted = data.busted || 0;
  state.stats.wasted = data.wasted || 0;
  const taken = data.caches || 0;
  let count = 0;
  for (const c of state.caches) {
    if (count < taken) {
      c.taken = true;
      count += 1;
    }
  }
  state.stats.caches = count;
}
