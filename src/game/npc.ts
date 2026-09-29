import { dungeons } from "../data/dungeons";
import { items } from "../data/items";
import { npcs } from "../data/npcs";
import { towns } from "../data/towns";
import type { EconomyState, NpcIntent, NpcSimulationState, NpcState } from "./types";

export const createNpcStates = (): NpcState[] => Object.values(npcs).map((npc) => ({ npcId: npc.id, townId: npc.homeTownId, gold: npc.startingGold, inventory: [], equipment: {}, level: 1, exp: 0, hp: 28, maxHp: 28, mp: 8, maxMp: 8, jobId: npc.jobId }));
const addItem = (npc: NpcState, itemId: string): NpcState => { const found = npc.inventory.find((entry) => entry.id === itemId); return { ...npc, inventory: found ? npc.inventory.map((entry) => entry === found ? { ...entry, quantity: entry.quantity + 1 } : entry) : [...npc.inventory, { id: itemId, quantity: 1 }] }; };
const weaponPower = (npc: NpcState) => npc.equipment.weapon ? (items[npc.equipment.weapon.id].attack ?? 0) + (npc.equipment.weapon.enhancement ?? 0) * 2 : 1;
/** Scores stateful goals; player targets are intentionally absent. */
export const chooseNpcIntent = (state: NpcState, economy: EconomyState): NpcIntent => {
  const npc = npcs[state.npcId];
  if (state.defeated || state.hp <= state.maxHp * 0.35) return { action: state.dungeonId ? "return" : "rest", score: 100, reason: "傷を癒やす" };
  if (state.dungeonId) return { action: "battle", score: 80, reason: "ダンジョンを進む" };
  if (!state.equipment.weapon && state.gold >= 18) return { action: "buy", score: 75, reason: "武器を整える" };
  if (state.equipment.weapon && (state.equipment.weapon.enhancement ?? 0) < 1 && state.gold >= 12 && state.inventory.some((item) => item.id === "iron_ore" && item.quantity >= 2)) return { action: "craft", score: 70, reason: "武器を鍛える" };
  if (npc.goal === "trade" && state.inventory.length) return { action: "sell", score: 65, reason: "荷を相場へ流す" };
  const foreignTown = Object.values(towns).find((town) => town.id !== state.townId && (npc.goal === "trade" || npc.riskTolerance > 0.7));
  if (foreignTown && state.gold >= foreignTown.travelCost + 10) return { action: "travel", score: npc.goal === "trade" ? 60 : 35, reason: "別の町の機会を探す" };
  return { action: "enterDungeon", score: 55, reason: "経験と素材を求める" };
};
const duel = (attacker: NpcState, defender: NpcState): [NpcState, NpcState, string] => { const damage = Math.max(1, 4 + attacker.level * 2 + weaponPower(attacker) - defender.level); const hp = defender.hp - damage; if (hp > 0) return [attacker, { ...defender, hp }, `${npcs[attacker.npcId].name}が${npcs[defender.npcId].name}へ${damage}の傷を与えた。`]; return [addItem({ ...attacker, gold: attacker.gold + Math.max(4, Math.floor(defender.gold * .15)), exp: attacker.exp + 12 }, "iron_ore"), { ...defender, hp: 0, defeated: true, dungeonId: undefined }, `${npcs[attacker.npcId].name}が${npcs[defender.npcId].name}を退けた。`]; };
/** A pure, server-schedulable tick. It has no player target or player attack path. */
export const simulateNpcTick = (simulation: NpcSimulationState, economy: EconomyState): NpcSimulationState => {
  const events: string[] = []; const next = simulation.npcs.map((npc) => ({ ...npc, inventory: [...npc.inventory] }));
  for (let index = 0; index < next.length; index += 1) { let npc = next[index]; const intent = chooseNpcIntent(npc, economy); npc = { ...npc, lastIntent: intent };
    if (intent.action === "rest") { npc = { ...npc, hp: npc.maxHp, mp: npc.maxMp, defeated: false }; events.push(`${npcs[npc.npcId].name}は町で休んだ。`); }
    else if (intent.action === "return") { npc = { ...npc, dungeonId: undefined, hp: Math.max(1, npc.hp) }; events.push(`${npcs[npc.npcId].name}は町へ引き返した。`); }
    else if (intent.action === "buy") { npc = { ...npc, gold: npc.gold - 18, equipment: { ...npc.equipment, weapon: { id: "bamboo_sword", quantity: 1 } } }; events.push(`${npcs[npc.npcId].name}は武器を買った。`); }
    else if (intent.action === "craft") { npc = { ...npc, gold: npc.gold - 12, inventory: npc.inventory.map((item) => item.id === "iron_ore" ? { ...item, quantity: item.quantity - 2 } : item).filter((item) => item.quantity > 0), equipment: { ...npc.equipment, weapon: { ...npc.equipment.weapon!, enhancement: (npc.equipment.weapon?.enhancement ?? 0) + 1 } } }; events.push(`${npcs[npc.npcId].name}は武器を鍛えた。`); }
    else if (intent.action === "sell") { const item = npc.inventory[0]; npc = item ? { ...npc, gold: npc.gold + Math.max(1, Math.floor(items[item.id].value * .55)), inventory: npc.inventory.slice(1) } : npc; events.push(`${npcs[npc.npcId].name}は品を売った。`); }
    else if (intent.action === "travel") { const town = Object.values(towns).find((candidate) => candidate.id !== npc.townId)!; npc = { ...npc, townId: town.id, gold: npc.gold - town.travelCost }; events.push(`${npcs[npc.npcId].name}は${town.name}へ移動した。`); }
    else if (intent.action === "enterDungeon") { const dungeon = Object.values(dungeons).find((candidate) => candidate.townId === npc.townId && candidate.rooms.length); if (dungeon) { npc = { ...npc, dungeonId: dungeon.id }; events.push(`${npcs[npc.npcId].name}は${dungeon.name}へ入った。`); } }
    else if (intent.action === "battle") { const rivalIndex = next.findIndex((candidate, candidateIndex) => candidateIndex !== index && candidate.dungeonId === npc.dungeonId && !candidate.defeated); if (rivalIndex >= 0) { const [winner, defender, event] = duel(npc, next[rivalIndex]); npc = winner; next[rivalIndex] = defender; events.push(event); } else { npc = addItem({ ...npc, exp: npc.exp + 8, gold: npc.gold + 7, hp: Math.max(1, npc.hp - 4) }, "iron_ore"); events.push(`${npcs[npc.npcId].name}は妖を退けた。`); } }
    if (npc.exp >= npc.level * 25) { npc = { ...npc, level: npc.level + 1, exp: npc.exp - npc.level * 25, maxHp: npc.maxHp + 4, hp: npc.maxHp + 4 }; events.push(`${npcs[npc.npcId].name}は成長した。`); } next[index] = npc; }
  return { tick: simulation.tick + 1, npcs: next, events };
};
