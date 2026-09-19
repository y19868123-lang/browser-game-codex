import type { TownDefinition } from "../game/types";

export const towns: Record<string, TownDefinition> = {
  hinata_post: { id: "hinata_post", name: "陽ノ宿場", description: "旅人と荷馬車が行き交う、穏やかな街道の宿場。", travelCost: 0, services: ["inn", "weaponShop", "toolShop", "blacksmith"], dungeonIds: ["twilight_field"], marketMultiplier: 1 },
  mist_port: { id: "mist_port", name: "霧凪の港", description: "海霧と異国の品が集まる港町。", travelCost: 14, services: ["inn", "toolShop", "auction"], dungeonIds: ["sunken_shrine"], marketMultiplier: 1.08 },
  cedar_village: { id: "cedar_village", name: "杉影の里", description: "山の霊気に守られた、鍛冶と薬草の里。", travelCost: 11, services: ["inn", "blacksmith", "casino"], dungeonIds: ["oni_mine"], marketMultiplier: 0.94 }
};
