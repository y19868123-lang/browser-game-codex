import { items } from "../data/items";
import type { Equipment, GameState, InventoryItem, ItemKind } from "./types";

let sequence = 0;
const equipmentKinds: ItemKind[] = ["weapon", "armor", "accessory"];

export const isEquipmentItem = (itemId: string): boolean => equipmentKinds.includes(items[itemId]?.kind);
export const createInstanceId = (itemId: string): string => `${itemId}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
export const itemLabel = (item: InventoryItem): string => `${items[item.id].name}${item.enhancement ? ` +${item.enhancement}` : ""}`;

export const createInventoryItem = (itemId: string, enhancement = 0): InventoryItem => isEquipmentItem(itemId)
  ? { id: itemId, quantity: 1, enhancement, instanceId: createInstanceId(itemId) }
  : { id: itemId, quantity: 1 };

export const addInventoryItem = (inventory: InventoryItem[], item: InventoryItem): InventoryItem[] => {
  if (isEquipmentItem(item.id)) return [...inventory, { ...item, quantity: 1, instanceId: item.instanceId ?? createInstanceId(item.id) }];
  const found = inventory.find((entry) => entry.id === item.id && !entry.instanceId);
  return found
    ? inventory.map((entry) => entry === found ? { ...entry, quantity: entry.quantity + item.quantity } : entry)
    : [...inventory, { ...item, instanceId: undefined }];
};

export const findInventoryItem = (inventory: InventoryItem[], selector: string): InventoryItem | undefined =>
  inventory.find((entry) => entry.instanceId === selector)
  ?? inventory.find((entry) => !entry.instanceId && entry.id === selector);

export const removeInventoryItem = (inventory: InventoryItem[], selector: string, amount = 1): InventoryItem[] => {
  const selected = findInventoryItem(inventory, selector);
  if (!selected) return inventory;
  return inventory.flatMap((entry) => entry !== selected ? [entry] : entry.quantity > amount ? [{ ...entry, quantity: entry.quantity - amount }] : []);
};

const legacyId = (itemId: string, ordinal: number): string => `legacy-${itemId}-${ordinal}`;

/** Converts only old equipment stacks/copies. Existing instance IDs remain stable. */
export const migrateEquipmentInstances = (state: GameState): GameState => {
  const inventory: InventoryItem[] = [];
  const ordinals: Record<string, number> = {};
  for (const entry of state.inventory) {
    if (!isEquipmentItem(entry.id)) { inventory.push({ ...entry }); continue; }
    for (let count = 0; count < Math.max(1, entry.quantity); count += 1) {
      ordinals[entry.id] = (ordinals[entry.id] ?? 0) + 1;
      inventory.push({ ...entry, quantity: 1, instanceId: count === 0 && entry.instanceId ? entry.instanceId : legacyId(entry.id, ordinals[entry.id]) });
    }
  }
  const equipment: Equipment = {};
  for (const slot of ["weapon", "armor", "accessory"] as const) {
    const equipped = state.equipment[slot];
    if (!equipped) continue;
    let match = equipped.instanceId ? inventory.find((entry) => entry.instanceId === equipped.instanceId) : undefined;
    match ??= inventory.find((entry) => entry.id === equipped.id && (entry.enhancement ?? 0) === (equipped.enhancement ?? 0));
    match ??= inventory.find((entry) => entry.id === equipped.id);
    if (!match) {
      ordinals[equipped.id] = (ordinals[equipped.id] ?? 0) + 1;
      match = { ...equipped, quantity: 1, instanceId: equipped.instanceId ?? legacyId(equipped.id, ordinals[equipped.id]) };
      inventory.push(match);
    } else if ((match.enhancement ?? 0) !== (equipped.enhancement ?? 0)) {
      match.enhancement = equipped.enhancement ?? 0;
    }
    equipment[slot] = { ...match, quantity: 1 };
  }
  return { ...state, inventory, equipment };
};
