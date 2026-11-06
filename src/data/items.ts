import type { ItemDefinition } from "../game/types";

export const items: Record<string, ItemDefinition> = {
  bamboo_sword: { id: "bamboo_sword", name: "竹刀", kind: "weapon", rarity: "common", description: "手になじむ軽い竹刀。", value: 18, attack: 3 },
  traveler_robe: { id: "traveler_robe", name: "旅人の羽織", kind: "armor", rarity: "common", description: "雨風をしのぐ簡素な羽織。", value: 20, defense: 2 },
  lucky_charm: { id: "lucky_charm", name: "結びの根付", kind: "accessory", rarity: "uncommon", description: "小さな幸運を呼ぶ根付。探索で希少品を見つけやすい。", value: 45, modifiers: { luk: 2 }, effects: [{ type: "dropRate", value: 0.04 }] },
  ash_prayer_beads: { id: "ash_prayer_beads", name: "灰の数珠", kind: "accessory", rarity: "rare", description: "深い業を秘めた者の術式を助ける数珠。", value: 85, modifiers: { karma: 4 }, effects: [{ type: "karmaGate", value: 15 }, { type: "skillCost", value: -1 }] },
  field_iron_blade: { id: "field_iron_blade", name: "野鉄の刀", kind: "weapon", rarity: "uncommon", description: "野辺の鉄を打ち締めた、扱いやすい刀。", value: 50, attack: 5 },
  dew_woven_robe: { id: "dew_woven_robe", name: "露織りの羽織", kind: "armor", rarity: "uncommon", description: "霊露を織り込み、術者の心を整える羽織。", value: 70, defense: 3, modifiers: { int: 1 } },
  fang_guard_cord: { id: "fang_guard_cord", name: "牙守りの緒", kind: "accessory", rarity: "uncommon", description: "鬼の牙を結び、力と守りを引き出す飾り緒。", value: 100, modifiers: { str: 1, vit: 1 } },
  twilight_iron_blade: { id: "twilight_iron_blade", name: "暮鉄の刀", kind: "weapon", rarity: "rare", description: "野鉄の刀へ妖気を馴染ませた、暮色の一振り。", value: 130, attack: 6, modifiers: { str: 1 } },
  iron_ore: { id: "iron_ore", name: "鉄鉱石", kind: "material", rarity: "common", description: "鍛冶の土台となる鉱石。", value: 6 },
  spirit_dew: { id: "spirit_dew", name: "霊露", kind: "material", rarity: "uncommon", description: "淡く光る露の結晶。", value: 18 },
  oni_fang: { id: "oni_fang", name: "鬼の牙", kind: "material", rarity: "rare", description: "荒々しい力を秘めた牙。", value: 50 }
};
