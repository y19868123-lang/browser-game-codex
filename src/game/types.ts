export type StatKey = "str" | "vit" | "dex" | "int" | "luk" | "karma";
export type ItemKind = "material" | "weapon" | "armor" | "accessory";
export type Rarity = "common" | "uncommon" | "rare";
export type JobCategory = "warrior" | "rogue" | "mystic" | "merchant";
export type ServiceType = "inn" | "weaponShop" | "toolShop" | "blacksmith" | "casino" | "auction";
export type BattleTarget = "npc" | "player";

export interface Stats { str: number; vit: number; dex: number; int: number; luk: number; karma: number }
export interface ItemEffect { type: "stat" | "dropRate" | "skillCost" | "karmaGate"; stat?: StatKey; value: number }
export interface ItemDefinition {
  id: string; name: string; kind: ItemKind; rarity: Rarity; description: string; value: number;
  attack?: number; defense?: number; modifiers?: Partial<Stats>; effects?: ItemEffect[]; requiredJobIds?: string[];
}
export interface InventoryItem { id: string; quantity: number; enhancement?: number; materialTraits?: string[] }
export interface EnemyDefinition { id: string; name: string; hp: number; attack: number; defense: number; exp: number; gold: number; trait?: "none" | "evasive" | "frenzied" | "cursed"; drops: Array<{ itemId: string; chance: number }> }
export interface SkillDefinition { id: string; name: string; description: string; jobIds: string[]; mpCost: number; target: "enemy" | "self"; power?: number; effect?: "guard" | "recover" | "fortune"; karmaRange?: [number, number] }
export interface JobDefinition { id: string; name: string; category: JobCategory; description: string; statGrowth: Partial<Stats>; skillIds: string[]; weaponKinds: ItemKind[]; changeRequirement: { level: number; gold: number } }
export interface TownDefinition { id: string; name: string; description: string; travelCost: number; services: ServiceType[]; dungeonIds: string[]; marketMultiplier: number }
export interface StoreDefinition { id: string; townId: string; name: string; service: "weaponShop" | "toolShop" | "blacksmith"; stock: Array<{ itemId: string; quantity: number; price: number }> }
export interface DungeonRoom { id: string; name: string; x: number; y: number; type: "entrance" | "battle" | "treasure" | "rest" | "boss"; enemyId?: string; lootIds?: string[]; links: string[] }
export interface DungeonDefinition { id: string; name: string; townId: string; description: string; actionCost: number; rooms: DungeonRoom[] }
export interface DungeonProgress { dungeonId: string; currentRoomId: string; visitedRoomIds: string[]; clearedRoomIds: string[]; completed: boolean }
export interface NpcDefinition { id: string; name: string; jobId: string; homeTownId: string; goal: "gather" | "trade" | "train" | "craft"; riskTolerance: number; startingGold: number; personality: string }
export interface NpcState { npcId: string; townId: string; gold: number; inventory: InventoryItem[]; equipment: Equipment; level: number; exp: number; hp: number; maxHp: number; mp: number; maxMp: number; jobId: string; dungeonId?: string; defeated?: boolean; lastIntent?: NpcIntent }
export interface NpcIntent { action: "explore" | "buy" | "sell" | "train" | "craft" | "rest" | "travel" | "enterDungeon" | "battle" | "return"; score: number; reason: string }
export interface NpcSimulationState { tick: number; npcs: NpcState[]; events: string[] }
export interface MarketQuote { itemId: string; basePrice: number; currentPrice: number; supply: number; demand: number }
export interface EconomyState { quotes: Record<string, MarketQuote>; listingsEnabled: boolean }
export interface AuctionListing { id: string; sellerId: string; item: InventoryItem; currentBid: number; bidderId?: string; closesAt: number; settled: boolean }
export interface CasinoResult { stake: number; payout: number; outcome: "loss" | "win" | "jackpot" }
export interface Equipment { weapon?: InventoryItem; armor?: InventoryItem; accessory?: InventoryItem }
export interface BattleState { enemy: EnemyDefinition; enemyHp: number; turn: number; message: string; target: BattleTarget; dungeonId?: string; roomId?: string }
export interface LogEntry { text: string; tone: "normal" | "good" | "danger" }
export interface GameState {
  name: string; level: number; exp: number; gold: number; actionPoints: number; maxActionPoints: number;
  hp: number; maxHp: number; mp: number; maxMp: number; stats: Stats; jobId: string; learnedSkillIds: string[];
  locationTownId: string; inventory: InventoryItem[]; equipment: Equipment; dungeon?: DungeonProgress;
  battle?: BattleState; log: LogEntry[]; explored: number; defeated: number; economy: EconomyState; auctionListings: AuctionListing[];
}
