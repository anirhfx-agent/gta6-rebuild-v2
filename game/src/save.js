// Save / load. Progress (cash, mission index, completed jobs, player spot)
// lives in localStorage under one key; the start screen offers Continue
// when a save exists. Nothing leaves the browser.
const KEY = 'solmar-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return s;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    const s = {
      money: game.player.money,
      missionIndex: game.missions.index,
      done: game.missions.done,
      hp: Math.max(25, Math.round(game.player.hp)),
      x: Math.round(game.player.x),
      y: Math.round(game.player.y),
      clock: game.clock,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked: the game still plays, it just does not save.
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
