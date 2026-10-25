import type { SkillDefinition } from "../game/types";

export const skills: Record<string, SkillDefinition> = {
  steady_strike: { id: "steady_strike", name: "正眼斬り", description: "集中して敵へ強い一撃を放つ。", jobIds: ["wanderer", "samurai", "shinobi", "onmyoji", "merchant"], category: "physical", mpCost: 3, target: "enemy", power: 7 },
  iron_guard: { id: "iron_guard", name: "鉄心", description: "この手番の被害を大幅に抑える。", jobIds: ["samurai"], category: "stance", mpCost: 2, target: "self", effect: "guard" },
  fortune_cut: { id: "fortune_cut", name: "福引きの刃", description: "LUKが高いほど会心になりやすい。", jobIds: ["shinobi", "merchant"], category: "physical", mpCost: 4, target: "enemy", power: 4, effect: "fortune" },
  spirit_mend: { id: "spirit_mend", name: "清めの札", description: "HPを回復する。業が深いほど効きが変わる。", jobIds: ["onmyoji"], category: "spell", mpCost: 4, target: "self", effect: "recover", karmaRange: [-50, 50] },
  warding_talisman: { id: "warding_talisman", name: "破邪の札", description: "霊力を札に通し、妖を打つ。", jobIds: ["onmyoji"], category: "spell", mpCost: 5, target: "enemy", power: 5, karmaRange: [-25, 25] }
};
