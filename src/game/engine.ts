import { enemies } from "../data/enemies";
import { dungeons } from "../data/dungeons";
import { items } from "../data/items";
import { jobs } from "../data/jobs";
import { skills } from "../data/skills";
import { createEconomy } from "./economy";
import type { EnemyDefinition, GameState, InventoryItem, ItemKind, LogEntry, StatKey } from "./types";

const log = (state: GameState, text: string, tone: LogEntry["tone"] = "normal"): GameState => ({ ...state, log: [{ text, tone }, ...state.log].slice(0, 8) });
const equippedBonus = (state: GameState, key: StatKey) => Object.values(state.equipment).reduce((total, item) => total + (item ? (items[item.id].modifiers?.[key] ?? 0) : 0), 0);
const attack = (state: GameState) => state.stats.str + weaponPower(state) + Math.floor(state.stats.dex / 3);
const defense = (state: GameState) => state.stats.vit + (items[state.equipment.armor?.id ?? ""]?.defense ?? 0);
const addItem = (inventory: InventoryItem[], item: InventoryItem): InventoryItem[] => {
  const found = inventory.find((entry) => entry.id === item.id && entry.enhancement === item.enhancement);
  return found ? inventory.map((entry) => entry === found ? { ...entry, quantity: entry.quantity + item.quantity } : entry) : [...inventory, item];
};
const takeItem = (inventory: InventoryItem[], id: string, amount = 1): InventoryItem[] => inventory.flatMap((entry) => entry.id !== id ? [entry] : entry.quantity > amount ? [{ ...entry, quantity: entry.quantity - amount }] : []);
export const expToNext = (level: number) => 30 + level * 20;
export const initialState = (): GameState => ({ name: "旅の者", level: 1, exp: 0, gold: 40, actionPoints: 8, maxActionPoints: 8, hp: 30, maxHp: 30, mp: 10, maxMp: 10, stats: { str: 5, vit: 4, dex: 4, int: 3, luk: 3, karma: 0 }, jobId: "wanderer", learnedSkillIds: ["steady_strike"], locationTownId: "hinata_post", inventory: [{ id: "bamboo_sword", quantity: 1 }, { id: "traveler_robe", quantity: 1 }, { id: "iron_ore", quantity: 2 }], equipment: { weapon: { id: "bamboo_sword", quantity: 1 }, armor: { id: "traveler_robe", quantity: 1 } }, log: [{ text: "陽ノ宿場から、あなたの旅が始まる。", tone: "normal" }], explored: 0, defeated: 0, economy: createEconomy(), auctionListings: [] });
export const explore = (state: GameState, random = Math.random): GameState => {
  if (state.battle) return log(state, "戦いの決着をつけてください。", "danger");
  if (state.actionPoints < 1) return log(state, "行動力が足りません。宿で休みましょう。", "danger");
  const next = { ...state, actionPoints: state.actionPoints - 1, explored: state.explored + 1 };
  const luck = state.stats.luk + equippedBonus(state, "luk");
  if (random() < 0.57) { const enemy = enemies[Math.min(enemies.length - 1, Math.floor(random() * enemies.length))]; return log({ ...next, battle: { enemy, enemyHp: enemy.hp, turn: 1, message: `${enemy.name}が行く手を阻んだ！`, target: "npc" } }, `${enemy.name}と遭遇した。`, "danger"); }
  const item = random() < 0.12 + luck * 0.012 ? "spirit_dew" : "iron_ore";
  return log({ ...next, inventory: addItem(next.inventory, { id: item, quantity: 1 }) }, `探索で「${items[item].name}」を見つけた。`, "good");
};
export const battleAction = (state: GameState, action: "attack" | "guard" | "flee", random = Math.random): GameState => {
  if (!state.battle) return state;
  const { enemy } = state.battle;
  if (action === "flee") {
    if (random() >= 0.55 + state.stats.dex * 0.025) return log({ ...state, battle: { ...state.battle, message: "逃走に失敗した！" } }, "逃走に失敗した。", "danger");
    const dungeon = retreatFromDungeonBattle(state);
    return log({ ...state, dungeon, battle: undefined }, dungeon ? "危険を避け、入口まで退いた。" : "危険を避け、戦いから離れた。");
  }
  const critical = action === "attack" && random() < 0.05 + (state.stats.luk + equippedBonus(state, "luk")) * 0.012;
  const evaded = action === "attack" && enemy.trait === "evasive" && random() < 0.2;
  const damage = evaded || action === "guard" ? 0 : Math.max(1, attack(state) + Math.floor(random() * 5) - enemy.defense) * (critical ? 2 : 1);
  const remaining = state.battle.enemyHp - damage;
  if (remaining <= 0) return victory(state, enemy, random, critical ? `会心の一撃！ ${enemy.name}を倒した。` : `${enemy.name}を倒した。`);
  const incoming = Math.max(1, enemy.attack + Math.floor(random() * 4) + (enemy.trait === "frenzied" ? 2 : 0) - defense(state) - (action === "guard" ? 4 : 0));
  const hp = Math.max(0, state.hp - incoming);
  if (hp === 0) return defeat(state);
  const hitText = action === "guard" ? `身を守り、${incoming}の傷を受けた。` : evaded ? `${enemy.name}は身を翻し、攻撃をかわした。` : `${critical ? "会心の" : ""}${damage}の傷を与え、${incoming}の傷を受けた。`;
  return log({ ...state, hp, battle: { ...state.battle, enemyHp: remaining, turn: state.battle.turn + 1, message: hitText } }, hitText, critical ? "good" : "normal");
};
const retreatFromDungeonBattle = (state: GameState) => {
  const roomId = state.battle?.roomId;
  if (!state.dungeon || !roomId) return state.dungeon;
  const entrance = dungeons[state.dungeon.dungeonId]?.rooms.find((room) => room.type === "entrance");
  if (!entrance) return state.dungeon;
  return { ...state.dungeon, currentRoomId: entrance.id, visitedRoomIds: state.dungeon.visitedRoomIds.filter((id) => id !== roomId) };
};
const defeat = (state: GameState): GameState => log({ ...state, hp: Math.ceil(state.maxHp * 0.45), gold: Math.max(0, state.gold - 8), dungeon: retreatFromDungeonBattle(state), battle: undefined }, state.dungeon ? "倒れ、入口まで運ばれた。8文を落とした。" : "倒れて宿場へ運ばれた。8文を落とした。", "danger");
export const useSkill = (state: GameState, skillId: string, random = Math.random): GameState => {
  const skill = skills[skillId];
  if (!state.battle || !skill || !state.learnedSkillIds.includes(skillId)) return log(state, "その技は今は使えません。", "danger");
  if (state.mp < skill.mpCost) return log(state, "MPが足りません。", "danger");
  if (skill.karmaRange && (state.stats.karma < skill.karmaRange[0] || state.stats.karma > skill.karmaRange[1])) return log(state, "今の業では、その術は結べません。", "danger");
  const battle = state.battle;
  const paid = { ...state, mp: state.mp - skill.mpCost };
  if (skill.effect === "recover") return log({ ...paid, hp: Math.min(paid.maxHp, paid.hp + 8 + paid.stats.int + Math.max(0, 5 - Math.abs(paid.stats.karma) / 10)) }, `「${skill.name}」で傷を清めた。`, "good");
  if (skill.effect === "guard") return battleAction(paid, "guard", random);
  const criticalBonus = skill.effect === "fortune" ? paid.stats.luk * 0.02 : 0;
  const enemy = battle.enemy;
  const critical = random() < 0.05 + criticalBonus;
  const damage = Math.max(1, attack(paid) + (skill.power ?? 0) + Math.floor(random() * 4) - enemy.defense) * (critical ? 2 : 1);
  const remaining = battle.enemyHp - damage;
  if (remaining <= 0) return victory(paid, enemy, random, `${skill.name}で${enemy.name}を倒した。`);
  const incoming = Math.max(1, enemy.attack + Math.floor(random() * 4) - defense(paid));
  if (paid.hp <= incoming) return defeat(paid);
  return log({ ...paid, hp: paid.hp - incoming, battle: { ...battle, enemyHp: remaining, turn: battle.turn + 1, message: `${skill.name}！ ${damage}の傷を与えた。` } }, `${skill.name}！ ${damage}の傷を与えた。`, critical ? "good" : "normal");
};
const victory = (state: GameState, enemy: EnemyDefinition, random: () => number, text: string): GameState => {
  const finishedBattle = state.battle;
  let next = { ...state, battle: undefined, gold: state.gold + enemy.gold, exp: state.exp + enemy.exp, defeated: state.defeated + 1 };
  const dropped = enemy.drops.filter((drop) => random() < drop.chance);
  next = { ...next, inventory: dropped.reduce((inventory, drop) => addItem(inventory, { id: drop.itemId, quantity: 1 }), next.inventory) };
  while (next.exp >= expToNext(next.level)) { next = { ...next, level: next.level + 1, exp: next.exp - expToNext(next.level), maxHp: next.maxHp + 6, hp: next.maxHp + 6, stats: { ...next.stats, str: next.stats.str + 1, vit: next.stats.vit + 1, luk: next.stats.luk + (next.level % 2 === 0 ? 1 : 0) } }; text += ` Lv.${next.level} へ到達！`; }
  const roomId = finishedBattle?.roomId;
  const dungeonId = finishedBattle?.dungeonId;
  const room = dungeonId && roomId ? dungeons[dungeonId]?.rooms.find((candidate) => candidate.id === roomId) : undefined;
  if (room && next.dungeon) next = { ...next, dungeon: { ...next.dungeon, clearedRoomIds: [...new Set([...next.dungeon.clearedRoomIds, room.id])] } };
  if (room?.type === "boss" && next.dungeon) { next = { ...next, gold: next.gold + 40, dungeon: { ...next.dungeon, completed: true }, inventory: addItem(next.inventory, { id: "lucky_charm", quantity: 1 }) }; text += " 深層を制し、結びの根付と40文を得た！"; }
  return log(next, `${text} ${enemy.gold}文と${enemy.exp}経験を得た。${dropped.length ? ` ${dropped.map((drop) => items[drop.itemId].name).join("、")}を手に入れた。` : ""}`, "good");
};
export const equip = (state: GameState, itemId: string): GameState => {
  const definition = items[itemId];
  const owned = state.inventory.filter((entry) => entry.id === itemId && entry.quantity > 0)
    .sort((a, b) => (b.enhancement ?? 0) - (a.enhancement ?? 0))[0];
  if (state.battle || !owned || !definition || definition.kind === "material") return state;
  const slot = definition.kind as Exclude<ItemKind, "material">;
  // Old saves kept enhancement only on equipment. Preserve that value too.
  const existing = state.equipment[slot];
  const enhancement = Math.max(owned.enhancement ?? 0, existing?.id === itemId ? existing.enhancement ?? 0 : 0);
  const inventory = state.inventory.map((entry) => entry === owned ? { ...entry, enhancement } : entry);
  return log({ ...state, inventory, equipment: { ...state.equipment, [slot]: { ...owned, quantity: 1, enhancement } } }, `「${definition.name}」を装備した。`, "good");
};
export const enhanceWeapon = (state: GameState): GameState => { const weapon = state.equipment.weapon; if (!weapon) return log(state, "強化する武器がありません。", "danger"); const ore = state.inventory.find((entry) => entry.id === "iron_ore")?.quantity ?? 0; const cost = 12 + (weapon.enhancement ?? 0) * 10; if (ore < 2 || state.gold < cost) return log(state, `強化には鉄鉱石2個と${cost}文が必要です。`, "danger"); const enhancement = (weapon.enhancement ?? 0) + 1; return log({ ...state, gold: state.gold - cost, inventory: takeItem(state.inventory, "iron_ore", 2).map((entry) => entry.id === weapon.id && (entry.enhancement === undefined || entry.enhancement === weapon.enhancement) ? { ...entry, enhancement } : entry), equipment: { ...state.equipment, weapon: { ...weapon, enhancement } } }, `鍛冶場で「${items[weapon.id].name}」を +${enhancement} に強化した。`, "good"); };
export const rest = (state: GameState): GameState => state.battle || state.dungeon ? log(state, "宿へ戻ってから休みましょう。", "danger") : log({ ...state, hp: state.maxHp, mp: state.maxMp, actionPoints: state.maxActionPoints }, "宿で英気を養った。HP・MP・行動力が回復した。", "good");
export const weaponPower = (state: GameState) => (state.equipment.weapon ? (items[state.equipment.weapon.id].attack ?? 0) + (state.equipment.weapon.enhancement ?? 0) * 2 : 0);
export const changeJob = (state: GameState, jobId: string): GameState => {
  const job = jobs[jobId];
  if (!job) return log(state, "その職業は存在しません。", "danger");
  if (state.level < job.changeRequirement.level || state.gold < job.changeRequirement.gold) return log(state, `転職にはLv.${job.changeRequirement.level}と${job.changeRequirement.gold}文が必要です。`, "danger");
  return log({ ...state, jobId, gold: state.gold - job.changeRequirement.gold, learnedSkillIds: [...new Set([...state.learnedSkillIds, ...job.skillIds])] }, `「${job.name}」の道を歩み始めた。`, "good");
};
