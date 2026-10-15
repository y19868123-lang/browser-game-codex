import { afterEach, describe, expect, it, vi } from "vitest";
import { enhanceWeapon, equip, initialState } from "../src/game/engine";
import { migrateEquipmentInstances } from "../src/game/inventory";
import { createBrowserStorage } from "../src/game/persistence";
import { sellToStore } from "../src/game/store";
import type { GameState, InventoryItem } from "../src/game/types";
import { createNpcStates } from "../src/game/npc";
import { renderApp } from "../src/ui/view";

const swords: InventoryItem[] = [
  { id: "bamboo_sword", quantity: 1, enhancement: 0, instanceId: "sword-zero" },
  { id: "bamboo_sword", quantity: 1, enhancement: 1, instanceId: "sword-one" },
  { id: "bamboo_sword", quantity: 1, enhancement: 3, instanceId: "sword-three" }
];
const withSwords = (): GameState => ({
  ...initialState(), gold: 200,
  inventory: [...swords, { id: "traveler_robe", quantity: 1, enhancement: 0, instanceId: "armor-one" }, { id: "iron_ore", quantity: 8 }],
  equipment: { weapon: { ...swords[0] }, armor: { id: "traveler_robe", quantity: 1, enhancement: 0, instanceId: "armor-one" } }
});
afterEach(() => vi.unstubAllGlobals());

describe("equipment instance identity", () => {
  it("keeps +0, +1, and +3 weapons as separate stable instances", () => {
    const state = withSwords();
    expect(state.inventory.filter((item) => item.id === "bamboo_sword").map((item) => [item.instanceId, item.enhancement])).toEqual([
      ["sword-zero", 0], ["sword-one", 1], ["sword-three", 3]
    ]);
  });
  it("equips the selected instance instead of another copy", () => {
    const state = equip(withSwords(), "sword-one");
    expect(state.equipment.weapon?.instanceId).toBe("sword-one");
    expect(state.equipment.weapon?.enhancement).toBe(1);
  });
  it("enhances only the currently equipped instance", () => {
    const state = enhanceWeapon(equip(withSwords(), "sword-one"));
    expect(state.inventory.filter((item) => item.id === "bamboo_sword").map((item) => [item.instanceId, item.enhancement])).toEqual([
      ["sword-zero", 0], ["sword-one", 2], ["sword-three", 3]
    ]);
    expect(state.equipment.weapon?.instanceId).toBe("sword-one");
    expect(state.equipment.weapon?.enhancement).toBe(2);
  });
  it("does not sell the equipped instance", () => {
    const state = equip(withSwords(), "sword-one");
    const sold = sellToStore(state, "hinata_weapons", "sword-one");
    expect(sold.gold).toBe(state.gold);
    expect(sold.inventory.some((item) => item.instanceId === "sword-one")).toBe(true);
    expect(sold.equipment.weapon?.instanceId).toBe("sword-one");
    expect(sold.log[0].text).toContain("装備中");
  });
  it("sells exactly one unequipped instance and keeps equipment valid", () => {
    const state = equip(withSwords(), "sword-one");
    const sold = sellToStore(state, "hinata_weapons", "sword-three");
    expect(sold.inventory.some((item) => item.instanceId === "sword-three")).toBe(false);
    expect(sold.inventory.some((item) => item.instanceId === "sword-zero")).toBe(true);
    expect(sold.equipment.weapon?.instanceId).toBe("sword-one");
    expect(sold.inventory.some((item) => item.instanceId === sold.equipment.weapon?.instanceId)).toBe(true);
    expect(sold.log[0].text).toContain("竹刀 +3");
  });
  it("migrates legacy equipment stacks and links the equipped copy", () => {
    const legacy: GameState = {
      ...initialState(),
      inventory: [{ id: "bamboo_sword", quantity: 3 }, { id: "traveler_robe", quantity: 1 }, { id: "iron_ore", quantity: 2 }],
      equipment: { weapon: { id: "bamboo_sword", quantity: 1, enhancement: 1 }, armor: { id: "traveler_robe", quantity: 1 } }
    };
    const migrated = migrateEquipmentInstances(legacy);
    const copies = migrated.inventory.filter((item) => item.id === "bamboo_sword");
    expect(copies).toHaveLength(3);
    expect(new Set(copies.map((item) => item.instanceId)).size).toBe(3);
    expect(migrated.equipment.weapon?.instanceId).toBe(copies[0].instanceId);
    expect(copies[0].enhancement).toBe(1);
  });
  it("preserves instance IDs through save and reload", () => {
    let raw: string | null = null;
    vi.stubGlobal("localStorage", { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; }, removeItem: () => { raw = null; } });
    const storage = createBrowserStorage("instances");
    const before = equip(withSwords(), "sword-three");
    storage.save(before);
    const after = storage.load()!;
    expect(after.inventory.map((item) => item.instanceId)).toEqual(before.inventory.map((item) => item.instanceId));
    expect(after.equipment.weapon?.instanceId).toBe("sword-three");
  });
  it("renders distinct mobile-friendly equipment and sale choices", () => {
    const html = renderApp(equip(withSwords(), "sword-one"), "town", false, { tick: 0, npcs: createNpcStates(), events: [] });
    expect(html).toContain("竹刀 +0");
    expect(html).toContain("竹刀 +1");
    expect(html).toContain("竹刀 +3");
    expect(html).toContain("個体 d-zero");
    expect(html).toContain('data-sell="hinata_weapons:sword-one" disabled');
    expect(html).toContain('data-sell="hinata_weapons:sword-three"');
  });
});
