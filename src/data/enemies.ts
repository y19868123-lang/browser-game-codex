import type { EnemyDefinition } from "../game/types";

export const enemies: EnemyDefinition[] = [
  { id: "field_imp", name: "野の小鬼", hp: 18, attack: 5, defense: 1, exp: 12, gold: 9, drops: [{ itemId: "iron_ore", chance: 0.7 }, { itemId: "spirit_dew", chance: 0.12 }] },
  { id: "mist_fox", name: "霞み狐", hp: 27, attack: 7, defense: 2, exp: 18, gold: 14, trait: "evasive", drops: [{ itemId: "spirit_dew", chance: 0.48 }, { itemId: "lucky_charm", chance: 0.06 }] },
  { id: "thorn_boar", name: "棘猪", hp: 42, attack: 11, defense: 4, exp: 31, gold: 27, trait: "frenzied", drops: [{ itemId: "iron_ore", chance: 0.9 }, { itemId: "oni_fang", chance: 0.13 }] },
  { id: "twilight_warden", name: "暮野の守り手", hp: 32, attack: 7, defense: 3, exp: 64, gold: 55, trait: "cursed", drops: [{ itemId: "oni_fang", chance: 1 }, { itemId: "spirit_dew", chance: 0.8 }] }
];
