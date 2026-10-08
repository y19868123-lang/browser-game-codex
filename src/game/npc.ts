import { dungeons } from "../data/dungeons";
import { enemies } from "../data/enemies";
import { items } from "../data/items";
import { npcs } from "../data/npcs";
import { towns } from "../data/towns";
import type { DungeonRoom, EconomyState, InventoryItem, NpcIntent, NpcSimulationState, NpcState } from "./types";

export const createNpcStates = (): NpcState[] => Object.values(npcs).map((npc) => ({
  npcId: npc.id,
  townId: npc.homeTownId,
  gold: npc.startingGold,
  inventory: [],
  equipment: {},
  level: 1,
  exp: 0,
  hp: 28,
  maxHp: 28,
  mp: 8,
  maxMp: 8,
  jobId: npc.jobId,
  completedDungeonIds: []
}));

const addInventoryItem = (inventory: InventoryItem[], itemId: string): InventoryItem[] => {
  const found = inventory.find((entry) => entry.id === itemId && !entry.enhancement);
  return found
    ? inventory.map((entry) => entry === found ? { ...entry, quantity: entry.quantity + 1 } : entry)
    : [...inventory, { id: itemId, quantity: 1 }];
};

const addItem = (npc: NpcState, itemId: string): NpcState => ({ ...npc, inventory: addInventoryItem(npc.inventory, itemId) });
const weaponPower = (npc: NpcState) => npc.equipment.weapon ? (items[npc.equipment.weapon.id].attack ?? 0) + (npc.equipment.weapon.enhancement ?? 0) * 2 : 1;
const defensePower = (npc: NpcState) => 2 + npc.level * 2 + (npc.equipment.armor ? (items[npc.equipment.armor.id].defense ?? 0) : 0);

const equipUsefulLoot = (npc: NpcState, itemId: string): NpcState => {
  const definition = items[itemId];
  if (!definition || definition.kind === "material") return npc;
  const slot = definition.kind;
  const equipped = npc.equipment[slot];
  const equippedDefinition = equipped ? items[equipped.id] : undefined;
  const score = definition.attack ?? definition.defense ?? definition.value;
  const equippedScore = equippedDefinition ? (equippedDefinition.attack ?? equippedDefinition.defense ?? equippedDefinition.value) : -1;
  return score > equippedScore ? { ...npc, equipment: { ...npc.equipment, [slot]: { id: itemId, quantity: 1 } } } : npc;
};

const receiveItem = (npc: NpcState, itemId: string): NpcState => equipUsefulLoot(addItem(npc, itemId), itemId);

const clearDungeon = (npc: NpcState): NpcState => ({
  ...npc,
  dungeonId: undefined,
  dungeonRoomId: undefined,
  dungeonVisitedRoomIds: undefined,
  dungeonClearedRoomIds: undefined,
  dungeonEnemyHp: undefined
});

const duel = (attacker: NpcState, defender: NpcState): [NpcState, NpcState, string] => {
  const damage = Math.max(1, 4 + attacker.level * 2 + weaponPower(attacker) - defender.level);
  const hp = defender.hp - damage;
  if (hp > 0) return [attacker, { ...defender, hp }, `${npcs[attacker.npcId].name}が${npcs[defender.npcId].name}へ${damage}の傷を与えた。`];
  return [
    addItem({ ...attacker, gold: attacker.gold + Math.max(4, Math.floor(defender.gold * 0.15)), exp: attacker.exp + 12 }, "iron_ore"),
    { ...clearDungeon(defender), hp: 0, defeated: true },
    `${npcs[attacker.npcId].name}が${npcs[defender.npcId].name}を退けた。`
  ];
};

const playableDungeonAt = (townId: string) => Object.values(dungeons).find((dungeon) => dungeon.townId === townId && dungeon.rooms.length > 0);

/** Scores stateful goals; player targets are intentionally absent. */
export const chooseNpcIntent = (state: NpcState, economy: EconomyState): NpcIntent => {
  const definition = npcs[state.npcId];
  const retreatThreshold = Math.max(0.08, 0.4 - definition.riskTolerance * 0.35);
  if (state.defeated || state.hp <= state.maxHp * retreatThreshold) return { action: state.dungeonId ? "return" : "rest", score: 100, reason: "傷を癒やす" };
  if (state.dungeonId) return { action: "explore", score: 80, reason: "ダンジョンの部屋を進む" };
  if (!state.equipment.weapon && state.gold >= 18) return { action: "buy", score: 75, reason: "武器を整える" };
  if (state.equipment.weapon && (state.equipment.weapon.enhancement ?? 0) < 1 && state.gold >= 12 && state.inventory.some((item) => item.id === "iron_ore" && item.quantity >= 2)) return { action: "craft", score: 70, reason: "武器を鍛える" };
  if (definition.goal === "trade" && state.inventory.length) return { action: "sell", score: 65, reason: "荷を相場へ流す" };
  if (playableDungeonAt(state.townId)) return { action: "enterDungeon", score: 60, reason: "経験と素材を求める" };
  const dungeonTown = Object.values(towns).find((town) => playableDungeonAt(town.id) && state.gold >= town.travelCost + 10);
  if (dungeonTown) return { action: "travel", score: 55, reason: "探索地のある町へ向かう" };
  const foreignTown = Object.values(towns).find((town) => town.id !== state.townId && (definition.goal === "trade" || definition.riskTolerance > 0.7));
  if (foreignTown && state.gold >= foreignTown.travelCost + 10) return { action: "travel", score: definition.goal === "trade" ? 50 : 35, reason: "別の町の機会を探す" };
  return { action: "train", score: 20, reason: "町で鍛錬する" };
};

const roomPriority = (room: DungeonRoom): number => ({ treasure: 0, rest: 1, battle: 2, boss: 3, entrance: 4 })[room.type];

const routeToVisitedRoom = (dungeon: typeof dungeons[string], startId: string, visited: Set<string>, target: (room: DungeonRoom) => boolean): DungeonRoom | undefined => {
  const queue: Array<{ roomId: string; path: string[] }> = [{ roomId: startId, path: [startId] }];
  const seen = new Set([startId]);
  while (queue.length) {
    const current = queue.shift()!;
    const room = dungeon.rooms.find((candidate) => candidate.id === current.roomId)!;
    if (current.roomId !== startId && target(room)) return dungeon.rooms.find((candidate) => candidate.id === current.path[1]);
    for (const linkedId of room.links) {
      if (visited.has(linkedId) && !seen.has(linkedId)) {
        seen.add(linkedId);
        queue.push({ roomId: linkedId, path: [...current.path, linkedId] });
      }
    }
  }
  return undefined;
};

const routeToUnvisitedRoom = (dungeon: typeof dungeons[string], startId: string, visited: Set<string>): DungeonRoom | undefined => {
  const queue: Array<{ roomId: string; path: string[] }> = [{ roomId: startId, path: [startId] }];
  const seen = new Set([startId]);
  while (queue.length) {
    const current = queue.shift()!;
    const room = dungeon.rooms.find((candidate) => candidate.id === current.roomId)!;
    const unexplored = room.links
      .map((roomId) => dungeon.rooms.find((candidate) => candidate.id === roomId))
      .filter((candidate): candidate is DungeonRoom => candidate !== undefined && !visited.has(candidate.id))
      .sort((left, right) => roomPriority(left) - roomPriority(right));
    if (unexplored[0]) return current.path.length === 1 ? unexplored[0] : dungeon.rooms.find((candidate) => candidate.id === current.path[1]);
    for (const linkedId of room.links) {
      if (visited.has(linkedId) && !seen.has(linkedId)) {
        seen.add(linkedId);
        queue.push({ roomId: linkedId, path: [...current.path, linkedId] });
      }
    }
  }
  return undefined;
};

const advanceNpcDungeon = (npc: NpcState, random: () => number): { npc: NpcState; event: string } => {
  const definition = npcs[npc.npcId];
  const dungeon = npc.dungeonId ? dungeons[npc.dungeonId] : undefined;
  const room = dungeon?.rooms.find((candidate) => candidate.id === npc.dungeonRoomId);
  if (!dungeon || !room) return { npc: clearDungeon(npc), event: `${definition.name}は道を見失い、町へ戻った。` };

  const cleared = new Set(npc.dungeonClearedRoomIds ?? []);
  if ((room.type === "battle" || room.type === "boss") && !cleared.has(room.id)) {
    const enemy = enemies.find((candidate) => candidate.id === room.enemyId);
    if (!enemy) {
      return {
        npc: { ...npc, dungeonClearedRoomIds: [...cleared, room.id], dungeonEnemyHp: undefined },
        event: `${definition.name}は${room.name}の静けさを確かめた。`
      };
    }
    const enemyHp = npc.dungeonEnemyHp ?? enemy.hp;
    const damage = Math.max(1, 10 + npc.level * 3 + weaponPower(npc) - enemy.defense);
    const remaining = enemyHp - damage;
    if (remaining <= 0) {
      let victorious: NpcState = { ...npc, gold: npc.gold + enemy.gold, exp: npc.exp + enemy.exp, dungeonEnemyHp: undefined };
      const drops = enemy.drops.filter((drop) => random() < drop.chance);
      victorious = drops.reduce((current, drop) => receiveItem(current, drop.itemId), victorious);
      victorious = { ...victorious, dungeonClearedRoomIds: [...cleared, room.id] };
      if (room.type === "boss") {
        victorious = receiveItem({
          ...victorious,
          gold: victorious.gold + 40,
          completedDungeonIds: [...new Set([...(victorious.completedDungeonIds ?? []), dungeon.id])]
        }, "lucky_charm");
        return {
          npc: clearDungeon(victorious),
          event: `${definition.name}は${enemy.name}を退け、${dungeon.name}を踏破して町へ帰還した。`
        };
      }
      const loot = drops.length ? ` ${drops.map((drop) => items[drop.itemId].name).join("、")}を得た。` : "";
      return { npc: victorious, event: `${definition.name}は${room.name}で${enemy.name}を退けた。${loot}`.trim() };
    }
    const incoming = Math.max(1, enemy.attack + (enemy.trait === "frenzied" ? 2 : 0) - defensePower(npc));
    const hp = npc.hp - incoming;
    if (hp <= 0) {
      return {
        npc: { ...clearDungeon(npc), hp: 0, defeated: true },
        event: `${definition.name}は${room.name}で${enemy.name}に敗れ、町へ運ばれた。`
      };
    }
    return {
      npc: { ...npc, hp, dungeonEnemyHp: remaining },
      event: `${definition.name}は${room.name}で${enemy.name}へ${damage}の傷を与え、${incoming}の傷を受けた。`
    };
  }

  if (room.type === "treasure" && !cleared.has(room.id)) {
    const looted = (room.lootIds ?? []).reduce((current, itemId) => receiveItem(current, itemId), npc);
    return {
      npc: { ...looted, dungeonClearedRoomIds: [...cleared, room.id] },
      event: `${definition.name}は${room.name}で${(room.lootIds ?? []).map((itemId) => items[itemId].name).join("、")}を見つけた。`
    };
  }

  if (room.type === "rest" && (npc.hp < npc.maxHp || npc.mp < npc.maxMp || !cleared.has(room.id))) {
    return {
      npc: { ...npc, hp: npc.maxHp, mp: npc.maxMp, dungeonClearedRoomIds: [...new Set([...cleared, room.id])] },
      event: `${definition.name}は${room.name}で傷と霊力を癒やした。`
    };
  }

  const visited = new Set(npc.dungeonVisitedRoomIds ?? [room.id]);
  const destination = npc.hp < npc.maxHp * 0.7 && room.type !== "rest"
    ? routeToVisitedRoom(dungeon, room.id, visited, (candidate) => candidate.type === "rest") ?? routeToUnvisitedRoom(dungeon, room.id, visited)
    : routeToUnvisitedRoom(dungeon, room.id, visited);
  if (!destination) return { npc: clearDungeon(npc), event: `${definition.name}は探索を終え、${dungeon.name}から町へ帰還した。` };
  return {
    npc: {
      ...npc,
      dungeonRoomId: destination.id,
      dungeonVisitedRoomIds: [...new Set([...visited, destination.id])],
      dungeonEnemyHp: undefined
    },
    event: `${definition.name}は${destination.name}へ進んだ。`
  };
};

const applyLevelUps = (npc: NpcState): { npc: NpcState; events: string[] } => {
  let next = npc;
  const events: string[] = [];
  while (next.exp >= next.level * 25) {
    const required = next.level * 25;
    next = { ...next, level: next.level + 1, exp: next.exp - required, maxHp: next.maxHp + 4, hp: next.maxHp + 4 };
    events.push(`${npcs[next.npcId].name}はLv.${next.level}へ成長した。`);
  }
  return { npc: next, events };
};

/** A pure, server-schedulable tick. It has no player target or player attack path. */
export const simulateNpcTick = (simulation: NpcSimulationState, economy: EconomyState, random = Math.random): NpcSimulationState => {
  const events: string[] = [];
  const skipIndexes = new Set<number>();
  const next: NpcState[] = simulation.npcs.map((npc) => ({
    ...npc,
    inventory: npc.inventory.map((item) => ({ ...item })),
    equipment: { ...npc.equipment },
    dungeonVisitedRoomIds: npc.dungeonVisitedRoomIds ? [...npc.dungeonVisitedRoomIds] : undefined,
    dungeonClearedRoomIds: npc.dungeonClearedRoomIds ? [...npc.dungeonClearedRoomIds] : undefined,
    completedDungeonIds: npc.completedDungeonIds ? [...npc.completedDungeonIds] : []
  }));
  for (let index = 0; index < next.length; index += 1) {
    if (skipIndexes.has(index)) continue;
    let npc = next[index];
    const intent = chooseNpcIntent(npc, economy);
    npc = { ...npc, lastIntent: intent };
    if (intent.action === "rest") {
      npc = { ...npc, hp: npc.maxHp, mp: npc.maxMp, defeated: false };
      events.push(`${npcs[npc.npcId].name}は町で休んだ。`);
    } else if (intent.action === "return") {
      npc = clearDungeon({ ...npc, hp: Math.max(1, npc.hp) });
      events.push(`${npcs[npc.npcId].name}は探索を切り上げ、町へ引き返した。`);
    } else if (intent.action === "buy") {
      npc = { ...npc, gold: npc.gold - 18, equipment: { ...npc.equipment, weapon: { id: "bamboo_sword", quantity: 1 } } };
      events.push(`${npcs[npc.npcId].name}は武器を買った。`);
    } else if (intent.action === "craft") {
      npc = {
        ...npc,
        gold: npc.gold - 12,
        inventory: npc.inventory.map((item) => item.id === "iron_ore" ? { ...item, quantity: item.quantity - 2 } : item).filter((item) => item.quantity > 0),
        equipment: { ...npc.equipment, weapon: { ...npc.equipment.weapon!, enhancement: (npc.equipment.weapon?.enhancement ?? 0) + 1 } }
      };
      events.push(`${npcs[npc.npcId].name}は武器を鍛えた。`);
    } else if (intent.action === "sell") {
      const item = npc.inventory[0];
      npc = item ? { ...npc, gold: npc.gold + Math.max(1, Math.floor(items[item.id].value * .55)), inventory: npc.inventory.slice(1) } : npc;
      events.push(`${npcs[npc.npcId].name}は品を売った。`);
    } else if (intent.action === "travel") {
      const town = Object.values(towns).find((candidate) => candidate.id !== npc.townId && playableDungeonAt(candidate.id))
        ?? Object.values(towns).find((candidate) => candidate.id !== npc.townId)!;
      npc = { ...npc, townId: town.id, gold: npc.gold - town.travelCost };
      events.push(`${npcs[npc.npcId].name}は${town.name}へ移動した。`);
    } else if (intent.action === "enterDungeon") {
      const dungeon = playableDungeonAt(npc.townId);
      const entrance = dungeon?.rooms.find((room) => room.type === "entrance");
      if (dungeon && entrance) {
        npc = {
          ...npc,
          dungeonId: dungeon.id,
          dungeonRoomId: entrance.id,
          dungeonVisitedRoomIds: [entrance.id],
          dungeonClearedRoomIds: [entrance.id],
          dungeonEnemyHp: undefined
        };
        events.push(`${npcs[npc.npcId].name}は${dungeon.name}の${entrance.name}へ入った。`);
      }
    } else if (intent.action === "explore") {
      const rivalIndex = next.findIndex((candidate, candidateIndex) => candidateIndex !== index
        && !skipIndexes.has(candidateIndex)
        && !candidate.defeated
        && candidate.dungeonId === npc.dungeonId
        && candidate.dungeonRoomId === npc.dungeonRoomId);
      if (rivalIndex >= 0 && random() > 0.94) {
        const [attacker, defender, event] = duel(npc, next[rivalIndex]);
        npc = attacker;
        next[rivalIndex] = defender;
        skipIndexes.add(rivalIndex);
        events.push(event);
      } else {
        const result = advanceNpcDungeon(npc, random);
        npc = result.npc;
        events.push(result.event);
      }
    } else if (intent.action === "train") {
      npc = { ...npc, exp: npc.exp + 3 };
      events.push(`${npcs[npc.npcId].name}は町で鍛錬した。`);
    }
    const leveled = applyLevelUps(npc);
    next[index] = leveled.npc;
    events.push(...leveled.events);
  }
  return { tick: simulation.tick + 1, npcs: next, events: [...simulation.events, ...events].slice(-24) };
};

export const simulateNpcTicks = (simulation: NpcSimulationState, economy: EconomyState, count: number, random = Math.random): NpcSimulationState => {
  let next = simulation;
  for (let tick = 0; tick < count; tick += 1) next = simulateNpcTick(next, economy, random);
  return next;
};
