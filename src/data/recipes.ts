import type { RecipeDefinition } from "../game/types";

export const recipes: Record<string, RecipeDefinition> = {
  forge_field_iron_blade: {
    id: "forge_field_iron_blade", name: "野鉄の刀", kind: "craft", facilities: ["blacksmith"],
    description: "集めた鉄鉱石から、強化の土台にもなる刀を打つ。",
    materials: [{ itemId: "iron_ore", quantity: 4 }], goldCost: 22, outputItemId: "field_iron_blade"
  },
  weave_dew_robe: {
    id: "weave_dew_robe", name: "露織りの羽織", kind: "craft", facilities: ["blacksmith"],
    description: "鉄の留め具と霊露で、術を助ける羽織を仕立てる。",
    materials: [{ itemId: "iron_ore", quantity: 2 }, { itemId: "spirit_dew", quantity: 2 }], goldCost: 28, outputItemId: "dew_woven_robe"
  },
  bind_fang_guard: {
    id: "bind_fang_guard", name: "牙守りの緒", kind: "craft", facilities: ["blacksmith"],
    description: "鬼の牙を霊露で鎮め、力と守りの飾り緒へ仕立てる。",
    materials: [{ itemId: "oni_fang", quantity: 1 }, { itemId: "spirit_dew", quantity: 2 }], goldCost: 35, outputItemId: "fang_guard_cord"
  },
  temper_twilight_blade: {
    id: "temper_twilight_blade", name: "暮鉄の刀", kind: "synthesis", facilities: ["blacksmith"],
    description: "野鉄の刀へ鬼の牙と霊露を合わせ、強化値を保ったまま鍛え直す。",
    materials: [{ itemId: "oni_fang", quantity: 1 }, { itemId: "spirit_dew", quantity: 1 }], goldCost: 35,
    inputEquipment: { itemId: "field_iron_blade", preserveEnhancement: true }, outputItemId: "twilight_iron_blade"
  }
};
