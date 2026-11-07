import type { GameState, NpcSimulationState } from "./types";
import { migrateEquipmentInstances } from "./inventory";

export interface GameStateStorage { load(): GameState | undefined; loadSimulation(): NpcSimulationState | undefined; save(state: GameState, simulation?: NpcSimulationState): void; clear(): void }
export const createBrowserStorage = (key = "ayakashi-no-kuni.save"): GameStateStorage => ({
  load: () => { try { const raw = localStorage.getItem(key); if (!raw) return undefined; const { auctionWorld: _, ...state } = JSON.parse(raw); return migrateEquipmentInstances(state as GameState); } catch { return undefined; } },
  loadSimulation: () => {
    try {
      const snapshot = JSON.parse(localStorage.getItem(key) ?? "null")?.auctionWorld;
      return snapshot?.version === 1 && Number.isSafeInteger(snapshot.state?.tick)
        && Array.isArray(snapshot.state?.npcs) && Array.isArray(snapshot.state?.events) ? snapshot.state : undefined;
    } catch { return undefined; }
  },
  save: (state, simulation) => localStorage.setItem(key, JSON.stringify(simulation ? { ...state, auctionWorld: { version: 1, state: simulation } } : state)), clear: () => localStorage.removeItem(key)
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
