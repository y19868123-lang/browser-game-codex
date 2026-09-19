import type { NpcDefinition } from "../game/types";

export const npcs: Record<string, NpcDefinition> = {
  kaya: { id: "kaya", name: "薬師カヤ", jobId: "onmyoji", homeTownId: "cedar_village", goal: "gather", riskTolerance: 0.2, startingGold: 120, personality: "安全第一で薬草を探す。" },
  jin: { id: "jin", name: "浪人ジン", jobId: "samurai", homeTownId: "hinata_post", goal: "train", riskTolerance: 0.85, startingGold: 90, personality: "強敵の噂を追う。" },
  fumi: { id: "fumi", name: "行商フミ", jobId: "merchant", homeTownId: "mist_port", goal: "trade", riskTolerance: 0.45, startingGold: 180, personality: "相場と旅人の需要を読む。" }
};
