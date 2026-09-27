import { describe, expect, it, vi } from "vitest";
import { battleAction, enhanceWeapon, explore, initialState, rest } from "../src/game/engine";
import { changeJob, useSkill } from "../src/game/engine";
import { createEconomy, recordMarketTrade } from "../src/game/economy";
import { chooseNpcIntent, createNpcStates, simulateNpcTick } from "../src/game/npc";
import { enterDungeon, leaveDungeon, moveDungeonRoom, travelToTown } from "../src/game/world";
import { buyFromStore, sellToStore } from "../src/game/store";
import { createAuctionListing, placeCasinoBet } from "../src/game/leisure";
import { dungeons } from "../src/data/dungeons";
import { createBrowserStorage } from "../src/game/persistence";

describe("basic game loop", () => {
  it("spends an action point and begins a battle when exploration finds an enemy", () => {
    const next = explore(initialState(), () => 0);
    expect(next.actionPoints).toBe(7);
    expect(next.battle?.enemy.name).toBe("野の小鬼");
  });
  it("awards progression when an enemy is defeated", () => {
    let state = explore(initialState(), () => 0);
    for (let index = 0; index < 10 && state.battle; index += 1) state = battleAction(state, "attack", () => 0.99);
    expect(state.battle).toBeUndefined();
    expect(state.gold).toBeGreaterThan(40);
    expect(state.defeated).toBe(1);
  });
  it("enhances a weapon with materials and gold", () => {
    const next = enhanceWeapon(initialState());
    expect(next.equipment.weapon?.enhancement).toBe(1);
    expect(next.gold).toBe(28);
    const baseEnemy = explore(initialState(), () => 0);
    const enhancedEnemy = explore(next, () => 0);
    const baseAttack = battleAction(baseEnemy, "attack", () => 0.2);
    const enhancedAttack = battleAction(enhancedEnemy, "attack", () => 0.2);
    expect(enhancedAttack.battle!.enemyHp).toBe(baseAttack.battle!.enemyHp - 2);
  });
  it("restores health and action points", () => {
    const state = { ...initialState(), hp: 4, actionPoints: 0 };
    const next = rest(state);
    expect(next.hp).toBe(next.maxHp);
    expect(next.actionPoints).toBe(next.maxActionPoints);
    expect(next.mp).toBe(next.maxMp);
  });
  it("does not allow inn recovery during battle or dungeon exploration", () => {
    const dungeon = enterDungeon({ ...initialState(), hp: 4, mp: 1 }, "twilight_field");
    expect(rest(dungeon).hp).toBe(4);
    const battle = moveDungeonRoom(dungeon, "meadow");
    expect(rest(battle).hp).toBe(4);
  });
  it("changes jobs through data-driven requirements and learns its skills", () => {
    const state = { ...initialState(), level: 3, gold: 100 };
    const next = changeJob(state, "samurai");
    expect(next.jobId).toBe("samurai");
    expect(next.learnedSkillIds).toContain("iron_guard");
  });
  it("spends MP when using an active skill", () => {
    const state = explore(initialState(), () => 0);
    const next = useSkill(state, "steady_strike", () => 0.99);
    expect(next.mp).toBe(7);
    expect(next.battle?.enemyHp ?? 0).toBeLessThan(state.battle!.enemyHp);
  });
  it("records discovered dungeon rooms without exposing the full map", () => {
    const entered = enterDungeon(initialState(), "twilight_field");
    const next = moveDungeonRoom(entered, "meadow");
    expect(next.dungeon?.visitedRoomIds).toEqual(["gate", "meadow"]);
    expect(next.dungeon?.visitedRoomIds).not.toContain("boss");
    expect(next.battle?.target).toBe("npc");
  });
  it("marks dungeon battles cleared and blocks bypassing an undefeated room", () => {
    const entered = enterDungeon(initialState(), "twilight_field");
    const encounter = moveDungeonRoom(entered, "meadow");
    const blocked = moveDungeonRoom({ ...encounter, battle: undefined }, "old_path");
    expect(blocked.dungeon?.currentRoomId).toBe("meadow");
    let won = encounter;
    for (let index = 0; index < 10 && won.battle; index += 1) won = battleAction(won, "attack", () => 0.99);
    expect(won.dungeon?.clearedRoomIds).toContain("meadow");
    expect(moveDungeonRoom(won, "old_path").dungeon?.currentRoomId).toBe("old_path");
  });
  it("returns to the entrance and allows a dungeon encounter retry after fleeing", () => {
    const entered = enterDungeon(initialState(), "twilight_field");
    const encounter = moveDungeonRoom(entered, "meadow");
    const fled = battleAction(encounter, "flee", () => 0);
    expect(fled.dungeon?.currentRoomId).toBe("gate");
    expect(fled.dungeon?.visitedRoomIds).not.toContain("meadow");
    expect(moveDungeonRoom(fled, "meadow").battle?.enemy.id).toBe("field_imp");
  });
  it("applies defeat handling when skill retaliation is lethal", () => {
    const encounter = moveDungeonRoom(enterDungeon({ ...initialState(), hp: 1 }, "twilight_field"), "meadow");
    const defeated = useSkill(encounter, "steady_strike", () => 0.2);
    expect(defeated.battle).toBeUndefined();
    expect(defeated.dungeon?.currentRoomId).toBe("gate");
    expect(defeated.gold).toBe(32);
  });
  it("plays the full starter dungeon route through rewards and return", () => {
    let state = enterDungeon(enhanceWeapon(initialState()), "twilight_field");
    state = moveDungeonRoom(state, "meadow");
    while (state.battle) state = battleAction(state, "attack", () => 0.99);
    state = moveDungeonRoom(state, "dew_cache");
    expect(state.inventory.find((item) => item.id === "spirit_dew")?.quantity).toBe(1);
    state = moveDungeonRoom(state, "meadow");
    state = moveDungeonRoom(state, "spring");
    expect(state.hp).toBe(state.maxHp);
    state = moveDungeonRoom(state, "thicket");
    while (state.battle) state = useSkill(state, "steady_strike", () => 0.99);
    state = moveDungeonRoom(state, "spring");
    state = moveDungeonRoom(state, "thicket");
    state = moveDungeonRoom(state, "watch");
    while (state.battle) state = useSkill(state, "steady_strike", () => 0.99);
    state = moveDungeonRoom(state, "thicket");
    state = moveDungeonRoom(state, "spring");
    state = moveDungeonRoom(state, "thicket");
    state = moveDungeonRoom(state, "watch");
    state = moveDungeonRoom(state, "boss");
    while (state.battle) state = useSkill(state, "steady_strike", () => 0.99);
    expect(state.dungeon?.completed).toBe(true);
    expect(state.inventory.some((item) => item.id === "lucky_charm")).toBe(true);
    expect(state.log[0].text).toContain("深層を制し");
    state = leaveDungeon(state);
    expect(state.dungeon).toBeUndefined();
    expect(state.locationTownId).toBe("hinata_post");
  });
  it("saves and reloads browser progress", () => {
    const memory = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key)
    });
    const storage = createBrowserStorage("test-save");
    const progressed = { ...initialState(), gold: 123, exp: 17 };
    storage.save(progressed);
    expect(storage.load()).toEqual(progressed);
    storage.clear();
    expect(storage.load()).toBeUndefined();
    vi.unstubAllGlobals();
  });
  it("prevents travel while inside a dungeon", () => {
    const entered = enterDungeon(initialState(), "twilight_field");
    expect(travelToTown(entered, "mist_port").locationTownId).toBe("hinata_post");
  });
  it("changes market prices from finite supply and demand", () => {
    const economy = recordMarketTrade(createEconomy(), "iron_ore", "buy", 5);
    expect(economy.quotes.iron_ore.currentPrice).toBeGreaterThanOrEqual(economy.quotes.iron_ore.basePrice);
  });
  it("NPC utility choices have no player-attack action", () => {
    const intent = chooseNpcIntent(createNpcStates()[0], createEconomy());
    expect(intent.action).not.toBe("attack");
  });
  it("buys and sells through a town store without UI state", () => {
    const bought = buyFromStore({ ...initialState(), gold: 50 }, "hinata_weapons", "bamboo_sword");
    expect(bought.gold).toBe(32);
    expect(bought.inventory.find((item) => item.id === "bamboo_sword")?.quantity).toBe(2);
    expect(sellToStore(bought, "hinata_weapons", "bamboo_sword").gold).toBeGreaterThan(32);
  });
  it("supports deterministic casino settlement and auction listing", () => {
    expect(placeCasinoBet(initialState(), 10, () => 0).gold).toBe(110);
    expect(createAuctionListing(initialState(), "iron_ore", 5, 100).auctionListings).toHaveLength(1);
  });
  it("defines a branched completed first dungeon with treasure, rest, and boss rooms", () => {
    const rooms = dungeons.twilight_field.rooms;
    expect(rooms).toHaveLength(9);
    expect(rooms.filter((room) => room.type === "treasure")).toHaveLength(2);
    expect(rooms.some((room) => room.type === "rest")).toBe(true);
    expect(rooms.find((room) => room.id === "meadow")?.links).toHaveLength(4);
    expect(rooms.find((room) => room.type === "boss")?.enemyId).toBe("twilight_warden");
  });
  it("runs persistent NPC ticks for rest, preparation, dungeon work, and never a player target", () => {
    const [kaya, jin] = createNpcStates();
    const injured = { ...kaya, hp: 2 };
    expect(chooseNpcIntent(injured, createEconomy()).action).toBe("rest");
    const prepared = simulateNpcTick({ tick: 0, npcs: [{ ...jin, gold: 100 }, kaya], events: [] }, createEconomy());
    expect(prepared.tick).toBe(1);
    expect(prepared.npcs[0].equipment.weapon).toBeDefined();
    const entered = simulateNpcTick(prepared, createEconomy());
    expect(entered.npcs.some((npc) => npc.dungeonId || npc.lastIntent?.action === "travel")).toBe(true);
    expect(entered.npcs.map((npc) => npc.lastIntent?.action)).not.toContain("attack");
  });
});
