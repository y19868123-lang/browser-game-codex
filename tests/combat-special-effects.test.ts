import { afterEach, describe, expect, it, vi } from "vitest";
import { battleAction, dropChance, effectiveKarmaRange, effectiveSkillCost, equip, evadeChance, fleeChance, initialState, useSkill } from "../src/game/engine";
import { createBrowserStorage } from "../src/game/persistence";
import { skills } from "../src/data/skills";
import type { EnemyDefinition, GameState, InventoryItem } from "../src/game/types";

const trainingEnemy: EnemyDefinition = { id: "training", name: "稽古妖", hp: 200, attack: 12, defense: 3, exp: 0, gold: 0, drops: [] };
const battleState = (overrides: Partial<GameState> = {}): GameState => ({
  ...initialState(),
  learnedSkillIds: ["steady_strike", "iron_guard", "fortune_cut", "spirit_mend", "warding_talisman"],
  battle: { enemy: trainingEnemy, enemyHp: trainingEnemy.hp, turn: 1, message: "稽古を始める。", target: "npc" },
  ...overrides
});
const sequence = (...values: number[]) => {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0.99;
};
const accessory = (id: "lucky_charm" | "ash_prayer_beads", instanceId: string): InventoryItem => ({ id, quantity: 1, enhancement: 0, instanceId });
const equipBeforeBattle = (state: GameState, instanceId: string): GameState => {
  const battle = state.battle;
  return { ...equip({ ...state, battle: undefined }, instanceId), battle };
};

afterEach(() => vi.unstubAllGlobals());

describe("job combat stats and equipped special effects", () => {
  it("uses STR for physical techniques and INT for offensive spells", () => {
    const physicalBase = useSkill(battleState(), "steady_strike", () => 0.99);
    const physicalStr = useSkill(battleState({ stats: { ...initialState().stats, str: 12 } }), "steady_strike", () => 0.99);
    const physicalInt = useSkill(battleState({ stats: { ...initialState().stats, int: 12 } }), "steady_strike", () => 0.99);
    expect(physicalStr.battle!.enemyHp).toBeLessThan(physicalBase.battle!.enemyHp);
    expect(physicalInt.battle!.enemyHp).toBe(physicalBase.battle!.enemyHp);

    const spellBase = useSkill(battleState(), "warding_talisman", () => 0.99);
    const spellInt = useSkill(battleState({ stats: { ...initialState().stats, int: 12 } }), "warding_talisman", () => 0.99);
    const spellStr = useSkill(battleState({ stats: { ...initialState().stats, str: 12 } }), "warding_talisman", () => 0.99);
    expect(spellInt.battle!.enemyHp).toBeLessThan(spellBase.battle!.enemyHp);
    expect(spellStr.battle!.enemyHp).toBe(spellBase.battle!.enemyHp);
  });

  it("uses DEX for physical support, evasion, and bounded escape chance", () => {
    const low = battleState();
    const high = battleState({ stats: { ...initialState().stats, dex: 20 } });
    const lowAttack = battleAction(low, "attack", sequence(0.99, 0.5, 0.1, 0.5));
    const highAttack = battleAction(high, "attack", sequence(0.99, 0.5, 0.1, 0.5));
    expect(highAttack.battle!.enemyHp).toBeLessThan(lowAttack.battle!.enemyHp);
    expect(highAttack.hp).toBe(high.hp);
    expect(lowAttack.hp).toBeLessThan(low.hp);
    expect(evadeChance(high)).toBeGreaterThan(evadeChance(low));
    expect(fleeChance({ ...high, stats: { ...high.stats, dex: 999 } })).toBe(0.95);
  });

  it("uses VIT to reduce enemy damage", () => {
    const low = battleAction(battleState(), "attack", () => 0.99);
    const highState = battleState({ stats: { ...initialState().stats, vit: 10 } });
    const high = battleAction(highState, "attack", () => 0.99);
    expect(highState.hp - high.hp).toBeLessThan(initialState().hp - low.hp);
  });

  it("uses LUK for critical hits and caps critical-sensitive outcomes", () => {
    const low = battleAction(battleState(), "attack", sequence(0.2, 0.5, 0.99, 0.5));
    const lucky = battleAction(battleState({ stats: { ...initialState().stats, luk: 20 } }), "attack", sequence(0.2, 0.5, 0.99, 0.5));
    expect(trainingEnemy.hp - lucky.battle!.enemyHp).toBe((trainingEnemy.hp - low.battle!.enemyHp) * 2);
    expect(dropChance(battleState({ stats: { ...initialState().stats, luk: 999 } }), 0.9)).toBe(0.95);
    expect(dropChance(battleState({ stats: { ...initialState().stats, luk: 0 } }), 1)).toBe(1);
  });

  it("applies dropRate only from the equipped accessory", () => {
    const charm = accessory("lucky_charm", "charm-drop");
    const bagOnly = battleState({ inventory: [...initialState().inventory, charm] });
    const equipped = equipBeforeBattle(bagOnly, charm.instanceId!);
    expect(dropChance(bagOnly, 0.1)).toBeCloseTo(0.115);
    expect(dropChance(equipped, 0.1)).toBeCloseTo(0.165);

    const dropEnemy: EnemyDefinition = { ...trainingEnemy, hp: 1, drops: [{ itemId: "spirit_dew", chance: 0.1 }] };
    const withoutDrop = battleAction({ ...bagOnly, battle: { enemy: dropEnemy, enemyHp: 1, turn: 1, message: "", target: "npc" } }, "attack", sequence(0.99, 0.99, 0.15));
    const withDrop = battleAction({ ...equipped, battle: { enemy: dropEnemy, enemyHp: 1, turn: 1, message: "", target: "npc" } }, "attack", sequence(0.99, 0.99, 0.15));
    expect(withoutDrop.inventory.some((item) => item.id === "spirit_dew")).toBe(false);
    expect(withDrop.inventory.some((item) => item.id === "spirit_dew")).toBe(true);
  });

  it("reduces actual skill MP cost but never below one", () => {
    const beads = accessory("ash_prayer_beads", "beads-cost");
    const bagOnly = battleState({ inventory: [...initialState().inventory, beads] });
    expect(effectiveSkillCost(bagOnly, "iron_guard")).toBe(2);
    const equipped = equipBeforeBattle(bagOnly, beads.instanceId!);
    expect(effectiveSkillCost(equipped, "iron_guard")).toBe(1);
    const used = useSkill(equipped, "iron_guard", () => 0.99);
    expect(used.mp).toBe(equipped.mp - 1);
  });

  it("uses karmaGate to relax spell conditions only while equipped", () => {
    const beads = accessory("ash_prayer_beads", "beads-karma");
    const bagOnly = battleState({ stats: { ...initialState().stats, karma: 36 }, inventory: [...initialState().inventory, beads] });
    const blocked = useSkill(bagOnly, "warding_talisman", () => 0.99);
    expect(blocked.mp).toBe(bagOnly.mp);
    expect(blocked.log[0].text).toContain("業");

    const equipped = equipBeforeBattle(bagOnly, beads.instanceId!);
    expect(effectiveKarmaRange(equipped, skills.warding_talisman)).toEqual([-40, 40]);
    const allowed = useSkill(equipped, "warding_talisman", () => 0.99);
    expect(allowed.mp).toBe(equipped.mp - 4);
    expect(allowed.battle!.enemyHp).toBeLessThan(equipped.battle!.enemyHp);
  });

  it("removes accessory effects after equipping another individual", () => {
    const beads = accessory("ash_prayer_beads", "beads-off");
    const charm = accessory("lucky_charm", "charm-on");
    const withBoth = battleState({ inventory: [...initialState().inventory, beads, charm] });
    const beadsOn = equipBeforeBattle(withBoth, beads.instanceId!);
    expect(effectiveSkillCost(beadsOn, "steady_strike")).toBe(2);
    const charmOn = equipBeforeBattle(beadsOn, charm.instanceId!);
    expect(charmOn.equipment.accessory?.instanceId).toBe("charm-on");
    expect(effectiveSkillCost(charmOn, "steady_strike")).toBe(3);
    expect(effectiveKarmaRange(charmOn, skills.warding_talisman)).toEqual([-25, 25]);
  });

  it("preserves the equipped instance and its effects through save and reload", () => {
    let raw: string | null = null;
    vi.stubGlobal("localStorage", { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem: () => { raw = null; } });
    const beads = accessory("ash_prayer_beads", "beads-save");
    const before = equipBeforeBattle(battleState({ inventory: [...initialState().inventory, beads] }), beads.instanceId!);
    const storage = createBrowserStorage("combat-effects");
    storage.save(before);
    const after = storage.load()!;
    expect(after.equipment.accessory?.instanceId).toBe("beads-save");
    expect(effectiveSkillCost(after, "steady_strike")).toBe(2);
    expect(effectiveKarmaRange(after, skills.warding_talisman)).toEqual([-40, 40]);
  });
});
