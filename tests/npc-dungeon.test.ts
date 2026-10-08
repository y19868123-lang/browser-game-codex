import { describe, expect, it } from "vitest";
import { createEconomy } from "../src/game/economy";
import { chooseNpcIntent, createNpcStates, simulateNpcTick, simulateNpcTicks } from "../src/game/npc";
import type { NpcSimulationState, NpcState } from "../src/game/types";

const jin = (): NpcState => createNpcStates().find((npc) => npc.npcId === "jin")!;
const simulationWith = (npc: NpcState): NpcSimulationState => ({ tick: 0, npcs: [npc], events: [] });

describe("NPC room-based dungeon exploration", () => {
  it("prepares in town, enters at the entrance, moves by links, and fights over multiple ticks", () => {
    let simulation = simulationWith(jin());
    simulation = simulateNpcTick(simulation, createEconomy(), () => 0);
    expect(simulation.npcs[0].equipment.weapon?.id).toBe("bamboo_sword");
    expect(simulation.npcs[0].dungeonId).toBeUndefined();

    simulation = simulateNpcTick(simulation, createEconomy(), () => 0);
    expect(simulation.npcs[0].dungeonId).toBe("twilight_field");
    expect(simulation.npcs[0].dungeonRoomId).toBe("gate");

    simulation = simulateNpcTick(simulation, createEconomy(), () => 0);
    expect(simulation.npcs[0].dungeonRoomId).toBe("meadow");
    expect(simulation.npcs[0].dungeonVisitedRoomIds).toEqual(["gate", "meadow"]);

    simulation = simulateNpcTick(simulation, createEconomy(), () => 0);
    expect(simulation.npcs[0].dungeonEnemyHp).toBeLessThan(18);
    expect(simulation.npcs[0].hp).toBeLessThan(simulation.npcs[0].maxHp);
    expect(simulation.events.at(-1)).toContain("野の小鬼へ");
  });

  it("collects treasure, equips useful loot, and recovers at a rest room", () => {
    const treasureHunter: NpcState = {
      ...jin(),
      equipment: { weapon: { id: "bamboo_sword", quantity: 1 } },
      dungeonId: "twilight_field",
      dungeonRoomId: "shrine_cache",
      dungeonVisitedRoomIds: ["gate", "meadow", "old_path", "shrine_cache"],
      dungeonClearedRoomIds: ["gate", "meadow", "old_path"]
    };
    const looted = simulateNpcTick(simulationWith(treasureHunter), createEconomy(), () => 0);
    expect(looted.npcs[0].inventory.some((item) => item.id === "lucky_charm")).toBe(true);
    expect(looted.npcs[0].equipment.accessory?.id).toBe("lucky_charm");
    expect(looted.npcs[0].dungeonClearedRoomIds).toContain("shrine_cache");

    const injured: NpcState = {
      ...looted.npcs[0],
      hp: 11,
      mp: 1,
      dungeonRoomId: "spring",
      dungeonVisitedRoomIds: [...(looted.npcs[0].dungeonVisitedRoomIds ?? []), "spring"]
    };
    const recovered = simulateNpcTick(simulationWith(injured), createEconomy(), () => 0);
    expect(recovered.npcs[0].hp).toBe(recovered.npcs[0].maxHp);
    expect(recovered.npcs[0].mp).toBe(recovered.npcs[0].maxMp);
    expect(recovered.events.at(-1)).toContain("傷と霊力を癒やした");
  });

  it("handles dungeon defeat, returns the NPC to town, and recovers next tick", () => {
    const endangered: NpcState = {
      ...jin(),
      hp: 5,
      equipment: { weapon: { id: "bamboo_sword", quantity: 1 } },
      dungeonId: "twilight_field",
      dungeonRoomId: "thicket",
      dungeonVisitedRoomIds: ["gate", "meadow", "spring", "thicket"],
      dungeonClearedRoomIds: ["gate", "meadow", "spring"],
      dungeonEnemyHp: 42
    };
    const defeated = simulateNpcTick(simulationWith(endangered), createEconomy(), () => 0);
    expect(defeated.npcs[0].defeated).toBe(true);
    expect(defeated.npcs[0].hp).toBe(0);
    expect(defeated.npcs[0].dungeonId).toBeUndefined();
    expect(defeated.events.at(-1)).toContain("町へ運ばれた");

    const rested = simulateNpcTick(defeated, createEconomy(), () => 0);
    expect(rested.npcs[0].defeated).toBe(false);
    expect(rested.npcs[0].hp).toBe(rested.npcs[0].maxHp);
  });

  it("runs a complete town-to-dungeon-to-town lifecycle across many ticks", () => {
    let simulation = simulationWith(jin());
    const observedEvents = new Set<string>();
    let largestVisitedCount = 0;
    for (let count = 0; count < 180; count += 1) {
      simulation = simulateNpcTick(simulation, createEconomy(), () => 0);
      simulation.events.forEach((event) => observedEvents.add(event));
      largestVisitedCount = Math.max(largestVisitedCount, simulation.npcs[0].dungeonVisitedRoomIds?.length ?? 0);
      if (simulation.npcs[0].completedDungeonIds?.includes("twilight_field") && !simulation.npcs[0].dungeonId) break;
    }
    const npc = simulation.npcs[0];
    expect(npc.completedDungeonIds).toContain("twilight_field");
    expect(npc.dungeonId).toBeUndefined();
    expect(npc.level).toBeGreaterThan(1);
    expect(npc.equipment.weapon?.enhancement).toBe(1);
    expect(npc.equipment.accessory?.id).toBe("lucky_charm");
    expect(npc.inventory.some((item) => item.id === "oni_fang")).toBe(true);
    expect(largestVisitedCount).toBeGreaterThanOrEqual(8);
    expect([...observedEvents].some((event) => event.includes("宝") || event.includes("隠し箱"))).toBe(true);
    expect([...observedEvents].some((event) => event.includes("傷と霊力を癒やした"))).toBe(true);
    expect([...observedEvents].some((event) => event.includes("踏破して町へ帰還した"))).toBe(true);
  });

  it("supports bounded batch ticking and never creates a player attack intent or target", () => {
    const result = simulateNpcTicks({ tick: 0, npcs: createNpcStates(), events: [] }, createEconomy(), 12, () => 0);
    expect(result.tick).toBe(12);
    expect(result.events.length).toBeLessThanOrEqual(24);
    expect(result.npcs.map((npc) => npc.lastIntent?.action)).not.toContain("attack");
    expect(result.events.join(" ")).not.toContain("プレイヤー");
    expect(chooseNpcIntent(result.npcs[0], createEconomy()).action).not.toBe("attack");
  });

  it("preserves NPC-to-NPC encounters without creating a player attack path", () => {
    const [kaya, rival] = createNpcStates();
    const sharedDungeon = {
      dungeonId: "twilight_field",
      dungeonRoomId: "gate",
      dungeonVisitedRoomIds: ["gate"],
      dungeonClearedRoomIds: ["gate"]
    };
    const result = simulateNpcTick({
      tick: 0,
      npcs: [
        { ...kaya, ...sharedDungeon, equipment: { weapon: { id: "bamboo_sword", quantity: 1 } } },
        { ...rival, ...sharedDungeon, hp: 1 }
      ],
      events: []
    }, createEconomy(), () => 0.99);
    expect(result.events.some((event) => event.includes("薬師カヤが浪人ジンを退けた"))).toBe(true);
    expect(result.events.join(" ")).not.toContain("プレイヤー");
  });
});
