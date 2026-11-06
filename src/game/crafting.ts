import { items } from "../data/items";
import { recipes } from "../data/recipes";
import { towns } from "../data/towns";
import { addInventoryItem, createInventoryItem, findInventoryItem, itemLabel, removeInventoryItem, removeMaterialQuantity } from "./inventory";
import type { GameState, InventoryItem, LogEntry, RecipeDefinition } from "./types";

const log = (state: GameState, text: string, tone: LogEntry["tone"] = "normal"): GameState => ({ ...state, log: [{ text, tone }, ...state.log].slice(0, 8) });
export const inventoryQuantity = (state: GameState, itemId: string): number => state.inventory.filter((entry) => entry.id === itemId).reduce((total, entry) => total + entry.quantity, 0);

export interface RecipeAvailability {
  available: boolean;
  reason?: "unavailable" | "materials" | "gold" | "target" | "equipped";
  target?: InventoryItem;
}

export const recipeAvailability = (state: GameState, recipe: RecipeDefinition, targetInstanceId?: string): RecipeAvailability => {
  const town = towns[state.locationTownId];
  if (state.battle || state.dungeon || !town || !recipe.facilities.some((facility) => town.services.includes(facility))) return { available: false, reason: "unavailable" };
  let target: InventoryItem | undefined;
  if (recipe.kind === "synthesis") {
    target = targetInstanceId ? findInventoryItem(state.inventory, targetInstanceId) : undefined;
    if (!target?.instanceId || target.id !== recipe.inputEquipment?.itemId) return { available: false, reason: "target" };
    if (Object.values(state.equipment).some((equipped) => equipped?.instanceId === target!.instanceId)) return { available: false, reason: "equipped", target };
  }
  if (recipe.materials.some((material) => inventoryQuantity(state, material.itemId) < material.quantity)) return { available: false, reason: "materials", target };
  if (state.gold < recipe.goldCost) return { available: false, reason: "gold", target };
  return { available: true, target };
};

const failureText = (availability: RecipeAvailability) => {
  if (availability.reason === "equipped") return "装備中の個体は合成に使えません。別の装備へ替えてください。";
  if (availability.reason === "target") return "合成する装備個体を確認できません。";
  if (availability.reason === "materials") return "必要な素材が足りません。";
  if (availability.reason === "gold") return "製作費用が足りません。";
  return "この町では、その製作を行えません。";
};

/** Validates every cost before applying one atomic inventory/gold update. */
export const executeRecipe = (state: GameState, recipeId: string, targetInstanceId?: string): GameState => {
  const recipe = recipes[recipeId];
  if (!recipe) return log(state, "その製作法は見つかりません。", "danger");
  const availability = recipeAvailability(state, recipe, targetInstanceId);
  if (!availability.available) return log(state, failureText(availability), "danger");

  let inventory = state.inventory;
  for (const material of recipe.materials) inventory = removeMaterialQuantity(inventory, material.itemId, material.quantity);
  if (availability.target?.instanceId) inventory = removeInventoryItem(inventory, availability.target.instanceId);
  const enhancement = recipe.inputEquipment?.preserveEnhancement ? availability.target?.enhancement ?? 0 : 0;
  const output = createInventoryItem(recipe.outputItemId, enhancement);
  inventory = addInventoryItem(inventory, output);
  const action = recipe.kind === "synthesis" ? `${itemLabel(availability.target!)}を「${itemLabel(output)}」へ合成した。` : `「${items[recipe.outputItemId].name}」を製作した。`;
  return log({ ...state, gold: state.gold - recipe.goldCost, inventory }, action, "good");
};
