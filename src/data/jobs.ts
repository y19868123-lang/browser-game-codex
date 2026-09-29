import type { JobDefinition } from "../game/types";

export const jobs: Record<string, JobDefinition> = {
  wanderer: { id: "wanderer", name: "旅人", category: "warrior", description: "どの道にも進める、駆け出しの冒険者。", statGrowth: { str: 1, vit: 1 }, skillIds: ["steady_strike"], weaponKinds: ["weapon"], changeRequirement: { level: 1, gold: 0 } },
  samurai: { id: "samurai", name: "侍", category: "warrior", description: "構えを崩さず、正面から強敵を斬る。", statGrowth: { str: 2, vit: 1 }, skillIds: ["steady_strike", "iron_guard"], weaponKinds: ["weapon", "armor"], changeRequirement: { level: 3, gold: 80 } },
  shinobi: { id: "shinobi", name: "忍び", category: "rogue", description: "身軽さと運を生かして危地を抜ける。", statGrowth: { dex: 2, luk: 1 }, skillIds: ["steady_strike", "fortune_cut"], weaponKinds: ["weapon", "accessory"], changeRequirement: { level: 3, gold: 80 } },
  onmyoji: { id: "onmyoji", name: "陰陽師", category: "mystic", description: "霊力を札へ託し、妖を鎮める。", statGrowth: { int: 2, luk: 1 }, skillIds: ["steady_strike", "spirit_mend"], weaponKinds: ["weapon", "accessory"], changeRequirement: { level: 3, gold: 80 } },
  merchant: { id: "merchant", name: "商人", category: "merchant", description: "品と相場を読み、世界を巡る。", statGrowth: { luk: 1, vit: 1 }, skillIds: ["steady_strike", "fortune_cut"], weaponKinds: ["weapon", "accessory"], changeRequirement: { level: 3, gold: 80 } }
};
