import { dungeons } from "../data/dungeons";
import { enemies } from "../data/enemies";
import { items } from "../data/items";
import { towns } from "../data/towns";
import type { DungeonProgress, GameState, LogEntry } from "./types";

const log = (state: GameState, text: string, tone: LogEntry["tone"] = "normal"): GameState => ({ ...state, log: [{ text, tone }, ...state.log].slice(0, 8) });
export const travelToTown = (state: GameState, townId: string): GameState => {
  const town = towns[townId];
  if (!town) return log(state, "その町はまだ地図にありません。", "danger");
  if (state.battle || state.dungeon) return log(state, "戦闘・探索を終えてから移動してください。", "danger");
  if (state.gold < town.travelCost) return log(state, `移動には${town.travelCost}文が必要です。`, "danger");
  return log({ ...state, locationTownId: townId, gold: state.gold - town.travelCost }, `${town.name}へ到着した。`, "good");
};
export const enterDungeon = (state: GameState, dungeonId: string): GameState => {
  const dungeon = dungeons[dungeonId];
  if (!dungeon || dungeon.townId !== state.locationTownId) return log(state, "この町からは入れない場所です。", "danger");
  if (state.actionPoints < dungeon.actionCost) return log(state, "行動力が足りません。", "danger");
  const entrance = dungeon.rooms.find((room) => room.type === "entrance");
  if (!entrance) return log(state, "このダンジョンは踏破記録の設計中です。", "danger");
  const progress: DungeonProgress = { dungeonId, currentRoomId: entrance.id, visitedRoomIds: [entrance.id], clearedRoomIds: [entrance.id], completed: false };
  return log({ ...state, actionPoints: state.actionPoints - dungeon.actionCost, dungeon: progress }, `${dungeon.name}へ足を踏み入れた。`, "good");
};
export const leaveDungeon = (state: GameState): GameState => state.dungeon ? log({ ...state, dungeon: undefined }, "ダンジョンから町へ戻った。") : state;
export const moveDungeonRoom = (state: GameState, roomId: string): GameState => {
  if (!state.dungeon || state.battle) return log(state, "移動できる状態ではありません。", "danger");
  const dungeon = dungeons[state.dungeon.dungeonId];
  const current = dungeon.rooms.find((room) => room.id === state.dungeon?.currentRoomId);
  const room = dungeon.rooms.find((candidate) => candidate.id === roomId);
  if (!current || !room || !current.links.includes(roomId)) return log(state, "そこへ続く道はありません。", "danger");
  if ((current.type === "battle" || current.type === "boss") && !state.dungeon.clearedRoomIds.includes(current.id)) return log(state, "立ちはだかる敵を退けるまで先へは進めません。", "danger");
  const visitedRoomIds = [...new Set([...state.dungeon.visitedRoomIds, room.id])];
  const firstVisit = !state.dungeon.visitedRoomIds.includes(room.id);
  const progress = { ...state.dungeon, currentRoomId: room.id, visitedRoomIds };
  if (firstVisit && room.enemyId) {
    const enemy = enemies.find((candidate) => candidate.id === room.enemyId);
    if (enemy) return log({ ...state, dungeon: progress, battle: { enemy, enemyHp: enemy.hp, turn: 1, message: `${enemy.name}が行く手を阻んだ！`, target: "npc", dungeonId: dungeon.id, roomId: room.id } }, `${enemy.name}と遭遇した。`, "danger");
  }
  if (firstVisit && room.lootIds) {
    const inventory = room.lootIds.reduce((current, itemId) => {
      const matching = current.find((entry) => entry.id === itemId);
      return matching ? current.map((entry) => entry === matching ? { ...entry, quantity: entry.quantity + 1 } : entry) : [...current, { id: itemId, quantity: 1 }];
    }, state.inventory);
    return log({ ...state, dungeon: { ...progress, clearedRoomIds: [...progress.clearedRoomIds, room.id] }, inventory }, `宝箱から「${room.lootIds.map((itemId) => items[itemId].name).join("・")}」を手に入れた。`, "good");
  }
  if (room.type === "rest") return log({ ...state, hp: state.maxHp, mp: state.maxMp, dungeon: { ...progress, clearedRoomIds: [...new Set([...progress.clearedRoomIds, room.id])] } }, "湧き水でHPとMPを回復した。", "good");
  return log({ ...state, dungeon: progress }, `「${room.type === "treasure" ? "宝物の間" : room.type === "boss" ? "深層" : "通路"}」へ進んだ。`);
};
