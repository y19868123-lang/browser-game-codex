import { afterEach, describe, expect, it, vi } from "vitest";
import { recipes } from "../src/data/recipes";
import { executeRecipe, recipeAvailability } from "../src/game/crafting";
import { effectiveSkillCost, enhanceWeapon, equip, initialState, weaponPower } from "../src/game/engine";
import { createBrowserStorage } from "../src/game/persistence";
import type { GameState, InventoryItem } from "../src/game/types";
import { createNpcStates } from "../src/game/npc";
import { renderApp } from "../src/ui/view";

const material = (id: string, quantity: number): InventoryItem => ({ id, quantity });
const fieldBlade = (instanceId: string, enhancement = 0): InventoryItem => ({ id: "field_iron_blade", quantity: 1, enhancement, instanceId });
const stocked = (gold = 200): GameState => ({
  ...initialState(), gold,
  inventory: [...initialState().inventory.filter((entry) => entry.id !== "iron_ore"), material("iron_ore", 12), material("spirit_dew", 8), material("oni_fang", 4)]
});

afterEach(() => vi.unstubAllGlobals());

describe("recipe crafting and equipment synthesis", () => {
  it("crafts weapon, armor, and accessory recipes with unique equipment instances", () => {
    let state = stocked();
    state = executeRecipe(state, "forge_field_iron_blade");
    state = executeRecipe(state, "weave_dew_robe");
    state = executeRecipe(state, "bind_fang_guard");
    const outputs = state.inventory.filter((entry) => ["field_iron_blade", "dew_woven_robe", "fang_guard_cord"].includes(entry.id));
    expect(outputs.map((entry) => entry.id)).toEqual(["field_iron_blade", "dew_woven_robe", "fang_guard_cord"]);
    expect(outputs.every((entry) => entry.instanceId && entry.quantity === 1)).toBe(true);
    expect(new Set(outputs.map((entry) => entry.instanceId)).size).toBe(3);
    expect(state.gold).toBe(115);
  });

  it("does not consume anything when materials are insufficient", () => {
    const before = { ...initialState(), gold: 200 };
    const after = executeRecipe(before, "forge_field_iron_blade");
    expect(after.gold).toBe(before.gold);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.log[0].text).toContain("素材");
  });

  it("does not consume anything when gold is insufficient", () => {
    const before = stocked(0);
    const after = executeRecipe(before, "forge_field_iron_blade");
    expect(after.gold).toBe(0);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.log[0].text).toContain("費用");
  });

  it("allows recipes only at a configured facility", () => {
    const before = { ...stocked(), locationTownId: "mist_port" };
    const after = executeRecipe(before, "forge_field_iron_blade");
    expect(after.gold).toBe(before.gold);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.log[0].text).toContain("この町");
    const html = renderApp(before, "town", false, { tick: 0, npcs: createNpcStates(), events: [] });
    expect(html).not.toContain("forge-panel");
  });

  it("consumes the exact requirement across split legacy material stacks", () => {
    const before = { ...stocked(), inventory: [...stocked().inventory.filter((entry) => entry.id !== "iron_ore"), material("iron_ore", 1), material("iron_ore", 4)] };
    const after = executeRecipe(before, "forge_field_iron_blade");
    expect(after.inventory.filter((entry) => entry.id === "iron_ore").reduce((sum, entry) => sum + entry.quantity, 0)).toBe(1);
    expect(after.inventory.some((entry) => entry.id === "field_iron_blade")).toBe(true);
  });

  it("creates distinct instance IDs for repeated copies of the same recipe", () => {
    const once = executeRecipe(stocked(), "forge_field_iron_blade");
    const twice = executeRecipe(once, "forge_field_iron_blade");
    const blades = twice.inventory.filter((entry) => entry.id === "field_iron_blade");
    expect(blades).toHaveLength(2);
    expect(blades[0].instanceId).not.toBe(blades[1].instanceId);
  });

  it("synthesizes only the selected instance and preserves its enhancement", () => {
    const zero = fieldBlade("field-zero", 0);
    const three = fieldBlade("field-three", 3);
    const before = { ...stocked(), inventory: [...stocked().inventory, zero, three] };
    const after = executeRecipe(before, "temper_twilight_blade", "field-three");
    expect(after.inventory.some((entry) => entry.instanceId === "field-zero")).toBe(true);
    expect(after.inventory.some((entry) => entry.instanceId === "field-three")).toBe(false);
    const result = after.inventory.find((entry) => entry.id === "twilight_iron_blade")!;
    expect(result.enhancement).toBe(3);
    expect(result.instanceId).toBeTruthy();
    expect(result.instanceId).not.toBe("field-three");
  });

  it("refuses to consume an equipped synthesis target atomically", () => {
    const target = fieldBlade("equipped-field", 2);
    const before = { ...stocked(), inventory: [...stocked().inventory, target], equipment: { ...stocked().equipment, weapon: { ...target } } };
    const after = executeRecipe(before, "temper_twilight_blade", target.instanceId);
    expect(recipeAvailability(before, recipes.temper_twilight_blade, target.instanceId).reason).toBe("equipped");
    expect(after.gold).toBe(before.gold);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.equipment.weapon?.instanceId).toBe("equipped-field");
    expect(after.log[0].text).toContain("装備中");
  });

  it("keeps enhancement and equipped special effects consistent after crafting", () => {
    const beads = { id: "ash_prayer_beads", quantity: 1, enhancement: 0, instanceId: "craft-beads" };
    let state = equip({ ...stocked(), inventory: [...stocked().inventory, beads, fieldBlade("forge-target", 2)] }, "craft-beads");
    expect(effectiveSkillCost(state, "steady_strike")).toBe(2);
    state = executeRecipe(state, "temper_twilight_blade", "forge-target");
    const result = state.inventory.find((entry) => entry.id === "twilight_iron_blade")!;
    expect(result.enhancement).toBe(2);
    expect(effectiveSkillCost(state, "steady_strike")).toBe(2);
    state = equip(state, result.instanceId!);
    state = enhanceWeapon(state);
    expect(state.equipment.weapon?.enhancement).toBe(3);
    expect(weaponPower(state)).toBe(12);
  });

  it("preserves crafted and synthesized instances through save and reload", () => {
    let raw: string | null = null;
    vi.stubGlobal("localStorage", { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem: () => { raw = null; } });
    let before = executeRecipe(stocked(), "forge_field_iron_blade");
    const target = before.inventory.find((entry) => entry.id === "field_iron_blade")!;
    before = executeRecipe(before, "temper_twilight_blade", target.instanceId);
    const storage = createBrowserStorage("crafting-save");
    storage.save(before);
    const after = storage.load()!;
    const crafted = after.inventory.find((entry) => entry.id === "twilight_iron_blade")!;
    expect(crafted.instanceId).toBe(before.inventory.find((entry) => entry.id === "twilight_iron_blade")?.instanceId);
    expect(crafted.enhancement).toBe(0);
  });

  it("loads a legacy save and can craft without adding required save fields", () => {
    const legacy = { ...stocked(), inventory: [material("iron_ore", 4), ...stocked().inventory.filter((entry) => entry.id !== "iron_ore").map(({ instanceId: _, ...entry }) => entry)] };
    let raw: string | null = JSON.stringify(legacy);
    vi.stubGlobal("localStorage", { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem: () => { raw = null; } });
    const loaded = createBrowserStorage("legacy-crafting").load()!;
    const crafted = executeRecipe(loaded, "forge_field_iron_blade");
    expect(crafted.inventory.find((entry) => entry.id === "field_iron_blade")?.instanceId).toBeTruthy();
  });

  it("renders separate enhancement, crafting, and synthesis controls with availability", () => {
    const disabled = renderApp(initialState(), "town", false, { tick: 0, npcs: createNpcStates(), events: [] });
    expect(disabled).toContain("一　強化");
    expect(disabled).toContain("二　製作");
    expect(disabled).toContain("三　合成");
    expect(disabled).toContain('data-craft="forge_field_iron_blade" disabled');
    expect(disabled).toContain("所持 2");

    const target = fieldBlade("ui-field", 1);
    const readyState = { ...stocked(), inventory: [...stocked().inventory, target] };
    const ready = renderApp(readyState, "town", false, { tick: 0, npcs: createNpcStates(), events: [] });
    expect(ready).toContain('data-craft="forge_field_iron_blade"');
    expect(ready).toContain('data-synthesize="temper_twilight_blade:ui-field"');
    expect(ready).toContain("強化値引継ぎ");
    expect(ready).toContain("攻撃 6・STR +1");
  });
});
