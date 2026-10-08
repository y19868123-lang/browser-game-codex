import { afterEach, describe, expect, it, vi } from "vitest";
import { battleAction, changeJob, expToNext, initialState, useSkill } from "../src/game/engine";
import { createBrowserStorage } from "../src/game/persistence";
import { jobs } from "../src/data/jobs";
import { enemies } from "../src/data/enemies";
import type { GameState, Stats } from "../src/game/types";

const win = (state: GameState, reward: number, skill = false): GameState => {
  const enemy = { ...enemies[0], exp: reward };
  const encounter = { ...state, battle: { enemy, enemyHp: 1, turn: 1, message: "", target: "npc" as const } };
  return skill ? useSkill(encounter, "steady_strike", () => 0.99) : battleAction(encounter, "attack", () => 0.99);
};
afterEach(() => vi.unstubAllGlobals());

describe("job-specific level growth", () => {
  const expected: Record<string, Partial<Stats>> = {
    wanderer: { str: 1, vit: 1 }, samurai: { str: 2, vit: 1 },
    shinobi: { dex: 2, luk: 1 }, onmyoji: { int: 2, luk: 1 }, merchant: { luk: 1, vit: 1 }
  };
  it.each(Object.keys(expected))("applies only %s growth and logs actual changes", (jobId) => {
    const before = { ...initialState(), jobId, hp: 3 };
    expect(jobs[jobId].statGrowth).toEqual(expected[jobId]);
    const next = win(before, expToNext(1));
    const stats = { ...before.stats };
    for (const [key, amount] of Object.entries(expected[jobId])) {
      stats[key as keyof Stats] += amount!;
      expect(next.log[0].text).toContain(`${key.toUpperCase()} +${amount}`);
    }
    expect(next.stats).toEqual(stats);
    expect(next.level).toBe(2);
    expect(next.exp).toBe(0);
    expect(next.maxHp).toBe(36);
    expect(next.hp).toBe(36);
    expect(next.maxMp).toBe(before.maxMp);
    expect(before.stats).toEqual(initialState().stats);
  });
  it("applies each level in a multiple-level skill victory", () => {
    const before = { ...initialState(), jobId: "shinobi" };
    const next = win(before, expToNext(1) + expToNext(2) + 7, true);
    expect(next.level).toBe(3);
    expect(next.exp).toBe(7);
    expect(next.stats).toEqual({ ...before.stats, dex: 8, luk: 5 });
    expect(next.maxHp).toBe(42);
    expect(next.hp).toBe(42);
    expect(next.log[0].text).toContain("Lv.2 へ到達！ DEX +2・LUK +1");
    expect(next.log[0].text).toContain("Lv.3 へ到達！ DEX +2・LUK +1");
  });
  it("preserves earned stats at job change and applies the new job only to future levels", () => {
    const raised = win(initialState(), expToNext(1) + expToNext(2));
    const changed = changeJob({ ...raised, gold: 100 }, "onmyoji");
    expect(changed.stats).toEqual(raised.stats);
    expect(changed.level).toBe(raised.level);
    expect(changed.maxHp).toBe(raised.maxHp);
    const next = win(changed, expToNext(3));
    expect(next.stats).toEqual({ ...raised.stats, int: raised.stats.int + 2, luk: raised.stats.luk + 1 });
    expect(next.maxHp).toBe(raised.maxHp + 6);
  });
  it("retains old save values and advances them without migration or recalculation", () => {
    let raw: string | null = null;
    vi.stubGlobal("localStorage", {
      getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem: () => { raw = null; }
    });
    const legacy = { ...initialState(), jobId: "merchant", level: 8, stats: { str: 20, vit: 18, dex: 9, int: 7, luk: 11, karma: -4 }, maxHp: 72, hp: 40 };
    const storage = createBrowserStorage();
    storage.save(legacy);
    const loaded = storage.load()!;
    expect(loaded).toEqual(legacy);
    const next = win(loaded, expToNext(8));
    expect(next.stats).toEqual({ ...legacy.stats, vit: 19, luk: 12 });
    expect(next.maxHp).toBe(78);
    expect(Object.keys(JSON.parse(JSON.stringify(next))).sort()).toEqual(Object.keys(legacy).sort());
    storage.save(next);
    expect(storage.load()).toEqual(next);
  });
});
