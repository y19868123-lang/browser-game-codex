import { afterEach, describe, expect, it, vi } from "vitest";
import { enhanceWeapon, equip, initialState, weaponPower } from "../src/game/engine";
import { createNpcStates, simulateNpcTicks } from "../src/game/npc";
import { createBrowserStorage, createNpcStorage } from "../src/game/persistence";
import { enterDungeon } from "../src/game/world";
import { renderApp } from "../src/ui/view";

afterEach(() => vi.unstubAllGlobals());
const mockStorage = () => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key)
  });
  return data;
};
describe("mobile play and persistence", () => {
  it("keeps dungeon and NPC progress across new storage adapter instances", () => {
    mockStorage();
    const player = enterDungeon(initialState(), "twilight_field");
    const npcs = simulateNpcTicks({ tick: 0, npcs: createNpcStates(), events: [] }, player.economy, 12, () => 0.5);
    createBrowserStorage().save(player);
    createNpcStorage().save(npcs);
    expect(createBrowserStorage().load()).toEqual(player);
    expect(createNpcStorage().load()).toEqual(npcs);
  });
  it("loads old player saves without an NPC snapshot", () => {
    mockStorage();
    createBrowserStorage().save(initialState());
    expect(createBrowserStorage().load()).toEqual(initialState());
    expect(createNpcStorage().load()).toBeUndefined();
  });
  it("ignores corrupt and unsupported snapshots", () => {
    const data = mockStorage();
    data.set("ayakashi-no-kuni.save", "bad json");
    data.set("ayakashi-no-kuni.npcs.v1", JSON.stringify({ version: 2 }));
    expect(createBrowserStorage().load()).toBeUndefined();
    expect(createNpcStorage().load()).toBeUndefined();
  });
  it("preserves enhancement through equipment changes and save reload", () => {
    mockStorage();
    const enhanced = enhanceWeapon(initialState());
    const reequipped = equip(enhanced, "bamboo_sword");
    createBrowserStorage().save(reequipped);
    expect(weaponPower(createBrowserStorage().load()!)).toBe(5);
    expect(reequipped.inventory.find(item => item.id === "bamboo_sword")?.enhancement).toBe(1);
    const legacy = { ...enhanced, inventory: initialState().inventory };
    expect(weaponPower(equip(legacy, "bamboo_sword"))).toBe(5);
    expect(equip(initialState(), "lucky_charm").equipment.accessory).toBeUndefined();
  });
  it("offers compact gear access, touch directions, and independent-save notice", () => {
    const state = enterDungeon(initialState(), "twilight_field");
    const html = renderApp(state, "journey", false, { tick: 0, npcs: createNpcStates(), events: [] });
    expect(html).toContain('class="gear-access"');
    expect(html).toContain("装備・持ち物を開く");
    expect(html.match(/data-direction=/g)).toHaveLength(4);
    expect(html).toContain("オンライン共有ワールドではありません");
    expect(html).not.toContain("雫の隠し箱");
  });
});
