import type { GameState } from "./types";

export interface GameStateStorage { load(): GameState | undefined; save(state: GameState): void; clear(): void }
export const createBrowserStorage = (key = "ayakashi-no-kuni.save"): GameStateStorage => ({
  load: () => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as GameState : undefined; } catch { return undefined; } },
  save: (state) => localStorage.setItem(key, JSON.stringify(state)), clear: () => localStorage.removeItem(key)
});
