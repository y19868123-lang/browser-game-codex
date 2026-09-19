import type { DungeonDefinition } from "../game/types";

export const dungeons: Record<string, DungeonDefinition> = {
  twilight_field: { id: "twilight_field", name: "薄明の野辺", townId: "hinata_post", description: "宿場の外れ。初めての妖が潜む。", actionCost: 1, rooms: [
    { id: "gate", x: 0, y: 2, type: "entrance", links: ["meadow"] },
    { id: "meadow", x: 1, y: 2, type: "battle", enemyId: "field_imp", links: ["gate", "dew_cache", "old_path", "spring"] },
    { id: "dew_cache", x: 1, y: 1, type: "treasure", lootIds: ["iron_ore", "spirit_dew"], links: ["meadow"] },
    { id: "spring", x: 1, y: 3, type: "rest", links: ["meadow", "thicket"] },
    { id: "old_path", x: 2, y: 2, type: "battle", enemyId: "mist_fox", links: ["meadow", "thicket", "shrine_cache"] },
    { id: "shrine_cache", x: 2, y: 1, type: "treasure", lootIds: ["lucky_charm"], links: ["old_path"] },
    { id: "thicket", x: 2, y: 3, type: "battle", enemyId: "thorn_boar", links: ["spring", "old_path", "watch"] },
    { id: "watch", x: 3, y: 3, type: "battle", enemyId: "thorn_boar", links: ["thicket", "boss"] },
    { id: "boss", x: 4, y: 3, type: "boss", enemyId: "twilight_warden", links: ["watch"] }
  ] },
  sunken_shrine: { id: "sunken_shrine", name: "沈み鳥居", townId: "mist_port", description: "満ち潮のたび、深部が姿を変える古社。", actionCost: 2, rooms: [] },
  oni_mine: { id: "oni_mine", name: "鬼火鉱山", townId: "cedar_village", description: "鬼火が灯る採掘坑。希少な鉱脈が眠る。", actionCost: 2, rooms: [] }
};
