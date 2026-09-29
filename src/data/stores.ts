import type { StoreDefinition } from "../game/types";

export const stores: Record<string, StoreDefinition> = {
  hinata_weapons: { id: "hinata_weapons", townId: "hinata_post", name: "茜武具店", service: "weaponShop", stock: [{ itemId: "bamboo_sword", quantity: 4, price: 18 }, { itemId: "lucky_charm", quantity: 1, price: 52 }] },
  hinata_tools: { id: "hinata_tools", townId: "hinata_post", name: "旅籠の道具棚", service: "toolShop", stock: [{ itemId: "iron_ore", quantity: 12, price: 7 }, { itemId: "spirit_dew", quantity: 3, price: 22 }] },
  cedar_forge: { id: "cedar_forge", townId: "cedar_village", name: "杉影鍛冶", service: "blacksmith", stock: [{ itemId: "traveler_robe", quantity: 3, price: 24 }, { itemId: "ash_prayer_beads", quantity: 1, price: 92 }] }
};
