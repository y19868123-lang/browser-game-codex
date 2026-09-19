import { describe, expect, it } from "vitest";
import { battleAction, enhanceWeapon, explore, initialState, rest } from "../src/game/engine";
import { changeJob, useSkill } from "../src/game/engine";
import { createEconomy, recordMarketTrade } from "../src/game/economy";
import { chooseNpcIntent, createNpcStates, simulateNpcTick } from "../src/game/npc";
import { enterDungeon, moveDungeonRoom, travelToTown } from "../src/game/world";
import { buyFromStore, sellToStore } from "../src/game/store";
import { createAuctionListing, placeCasinoBet } from "../src/game/leisure";
import { dungeons } from "../src/data/dungeons";

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
  });
  it("restores health and action points", () => {
    const state = { ...initialState(), hp: 4, actionPoints: 0 };
    const next = rest(state);
    expect(next.hp).toBe(next.maxHp);
    expect(next.actionPoints).toBe(next.maxActionPoints);
    expect(next.mp).toBe(next.maxMp);
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
    expect(next.battle?.enemyHp).toBeLessThan(state.battle!.enemyHp);
  });
  it("records discovered dungeon rooms without exposing the full map", () => {
    const entered = enterDungeon(initialState(), "twilight_field");
    const next = moveDungeonRoom(entered, "path");
    expect(next.dungeon?.visitedRoomIds).toEqual(["gate", "path"]);
    expect(next.dungeon?.visitedRoomIds).not.toContain("boss");
    expect(next.battle?.target).toBe("npc");
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
    expect(entered.npcs.every((npc) => npc.lastIntent?.action !== "attack")).toBe(true);
  });
});
