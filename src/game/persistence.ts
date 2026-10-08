import type { GameState, NpcSimulationState } from "./types";

export interface GameStateStorage { load(): GameState | undefined; save(state: GameState): void; clear(): void }
export const createBrowserStorage = (key = "ayakashi-no-kuni.save"): GameStateStorage => ({
  load: () => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as GameState : undefined; } catch { return undefined; } },
  save: (state) => localStorage.setItem(key, JSON.stringify(state)), clear: () => localStorage.removeItem(key)
});

/** Separate, versioned snapshot; a future server repository can replace this adapter. */
export const createNpcStorage = (key = "ayakashi-no-kuni.npcs.v1") => ({
  load(): NpcSimulationState | undefined {
    try {
      const raw = localStorage.getItem(key);
      const snapshot = raw ? JSON.parse(raw) : undefined;
      if (snapshot?.version !== 1 || !Number.isInteger(snapshot.state?.tick)
        || !Array.isArray(snapshot.state?.npcs) || !Array.isArray(snapshot.state?.events)) return undefined;
      return snapshot.state as NpcSimulationState;
    } catch { return undefined; }
  },
  save(state: NpcSimulationState): void {
    localStorage.setItem(key, JSON.stringify({ version: 1, state }));
  }
});
