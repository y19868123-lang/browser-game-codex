import { items } from "../data/items";
import { stores } from "../data/stores";
import type { GameState, InventoryItem, LogEntry } from "./types";
import { addInventoryItem, createInventoryItem, findInventoryItem, isEquipmentItem, itemLabel, removeInventoryItem } from "./inventory";

const log = (state: GameState, text: string, tone: LogEntry["tone"] = "normal") => ({ ...state, log: [{ text, tone }, ...state.log].slice(0, 8) });
const add = (inventory: InventoryItem[], itemId: string) => addInventoryItem(inventory, createInventoryItem(itemId));
export const buyFromStore = (state: GameState, storeId: string, itemId: string): GameState => {
  const store = stores[storeId]; const entry = store?.stock.find((stock) => stock.itemId === itemId);
  if (!store || store.townId !== state.locationTownId || !entry || entry.quantity < 1) return log(state, "その品は今は扱っていません。", "danger");
  if (state.gold < entry.price) return log(state, "文が足りません。", "danger");
  return log({ ...state, gold: state.gold - entry.price, inventory: add(state.inventory, itemId) }, `「${items[itemId].name}」を${entry.price}文で買った。`, "good");
};
export const sellToStore = (state: GameState, storeId: string, selector: string): GameState => {
  const store = stores[storeId]; const owned = findInventoryItem(state.inventory, selector);
  if (!store || store.townId !== state.locationTownId || !owned || owned.quantity < 1 || !store.stock.some((stock) => stock.itemId === owned.id)) return log(state, "売却できる品がありません。", "danger");
  if (isEquipmentItem(owned.id) && Object.values(state.equipment).some((equipped) => equipped?.instanceId === owned.instanceId)) {
    return log(state, `装備中の「${itemLabel(owned)}」は売れません。別の装備に替えてください。`, "danger");
  }
  const price = Math.max(1, Math.floor(items[owned.id].value * 0.55));
  const inventory = removeInventoryItem(state.inventory, owned.instanceId ?? owned.id);
  return log({ ...state, gold: state.gold + price, inventory }, `「${itemLabel(owned)}」を${price}文で売った。`, "good");
};
