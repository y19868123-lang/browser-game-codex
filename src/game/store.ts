import { items } from "../data/items";
import { stores } from "../data/stores";
import type { GameState, InventoryItem, LogEntry } from "./types";

const log = (state: GameState, text: string, tone: LogEntry["tone"] = "normal") => ({ ...state, log: [{ text, tone }, ...state.log].slice(0, 8) });
const add = (inventory: InventoryItem[], itemId: string) => { const found = inventory.find((entry) => entry.id === itemId); return found ? inventory.map((entry) => entry === found ? { ...entry, quantity: entry.quantity + 1 } : entry) : [...inventory, { id: itemId, quantity: 1 }]; };
export const buyFromStore = (state: GameState, storeId: string, itemId: string): GameState => {
  const store = stores[storeId]; const entry = store?.stock.find((stock) => stock.itemId === itemId);
  if (!store || store.townId !== state.locationTownId || !entry || entry.quantity < 1) return log(state, "その品は今は扱っていません。", "danger");
  if (state.gold < entry.price) return log(state, "文が足りません。", "danger");
  return log({ ...state, gold: state.gold - entry.price, inventory: add(state.inventory, itemId) }, `「${items[itemId].name}」を${entry.price}文で買った。`, "good");
};
export const sellToStore = (state: GameState, storeId: string, itemId: string): GameState => {
  const store = stores[storeId]; const owned = state.inventory.find((entry) => entry.id === itemId);
  if (!store || store.townId !== state.locationTownId || !owned || owned.quantity < 1) return log(state, "売却できる品がありません。", "danger");
  const price = Math.max(1, Math.floor(items[itemId].value * 0.55));
  const inventory = state.inventory.flatMap((entry) => entry.id !== itemId ? [entry] : entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : []);
  return log({ ...state, gold: state.gold + price, inventory }, `「${items[itemId].name}」を${price}文で売った。`, "good");
};
