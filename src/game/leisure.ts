import { items } from "../data/items";
import type { AuctionListing, CasinoResult, GameState, InventoryItem, LogEntry } from "./types";

const log = (state: GameState, text: string, tone: LogEntry["tone"] = "normal") => ({ ...state, log: [{ text, tone }, ...state.log].slice(0, 8) });
export const placeCasinoBet = (state: GameState, stake: number, random = Math.random): GameState => {
  if (!Number.isInteger(stake) || stake < 1 || state.gold < stake) return log(state, "賭け金が不正です。", "danger");
  const roll = random(); const result: CasinoResult = roll < 0.06 ? { stake, payout: stake * 8, outcome: "jackpot" } : roll < 0.46 + state.stats.luk * 0.01 ? { stake, payout: stake * 2, outcome: "win" } : { stake, payout: 0, outcome: "loss" };
  return log({ ...state, gold: state.gold - stake + result.payout, stats: { ...state.stats, karma: state.stats.karma + (result.outcome === "jackpot" ? 1 : 0) } }, result.outcome === "loss" ? `${stake}文を失った。` : `${result.payout}文の払い戻し！`, result.outcome === "loss" ? "danger" : "good");
};
export const createAuctionListing = (state: GameState, itemId: string, openingBid: number, closesAt: number): GameState => {
  const owned = state.inventory.find((item) => item.id === itemId);
  if (!owned || openingBid < 1) return log(state, "出品できる品がありません。", "danger");
  const inventory = state.inventory.flatMap((item) => item.id !== itemId ? [item] : item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : []);
  const listing: AuctionListing = { id: `auction-${state.auctionListings.length + 1}`, sellerId: "player", item: { ...owned, quantity: 1 }, currentBid: openingBid, closesAt, settled: false };
  return log({ ...state, inventory, auctionListings: [...state.auctionListings, listing] }, `「${itemId}」を競売へ出品した。`, "good");
};
export const bidOnAuction = (state: GameState, listingId: string, bid: number, bidderId = "player"): GameState => {
  const listing = state.auctionListings.find((entry) => entry.id === listingId);
  const refundedGold = listing?.bidderId === "player" ? listing.currentBid : 0;
  const availableGold = state.gold + refundedGold;
  if (!listing || listing.settled || bidderId === listing.sellerId || bid <= listing.currentBid || (bidderId === "player" && availableGold < bid)) return log(state, "入札できません。", "danger");
  return log({
    ...state,
    gold: bidderId === "player" ? availableGold - bid : availableGold,
    auctionListings: state.auctionListings.map((entry) => entry.id === listingId ? { ...entry, currentBid: bid, bidderId } : entry)
  }, `${bid}文で入札した。`, "good");
};

const addAuctionItem = (inventory: InventoryItem[], item: InventoryItem): InventoryItem[] => {
  const found = inventory.find((entry) => entry.id === item.id && entry.enhancement === item.enhancement);
  return found
    ? inventory.map((entry) => entry === found ? { ...entry, quantity: entry.quantity + item.quantity } : entry)
    : [...inventory, { ...item }];
};

export const settleAuction = (state: GameState, listingId: string, now = Date.now()): GameState => {
  const listing = state.auctionListings.find((entry) => entry.id === listingId);
  if (!listing || listing.settled || now < listing.closesAt) return log(state, "競売はまだ精算できません。", "danger");
  let gold = state.gold;
  let inventory = state.inventory;
  let message: string;
  if (!listing.bidderId) {
    if (listing.sellerId === "player") inventory = addAuctionItem(inventory, listing.item);
    message = `「${items[listing.item.id].name}」は落札されず、出品者へ戻った。`;
  } else {
    if (listing.sellerId === "player") gold += listing.currentBid;
    if (listing.bidderId === "player") inventory = addAuctionItem(inventory, listing.item);
    message = `「${items[listing.item.id].name}」が${listing.currentBid}文で落札され、取引が成立した。`;
  }
  return log({
    ...state,
    gold,
    inventory,
    auctionListings: state.auctionListings.map((entry) => entry.id === listingId ? { ...entry, settled: true } : entry)
  }, message, "good");
};
