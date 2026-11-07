import { items } from "../data/items";
import { npcs } from "../data/npcs";
import { towns } from "../data/towns";
import { addInventoryItem, itemLabel, removeInventoryItem } from "./inventory";
import { bidOnAuction, createAuctionListing, settleAuction } from "./leisure";
import type { AuctionListing, GameState, NpcSimulationState } from "./types";

export const auctionDuration = 6;
const legacyTown = "mist_port";
export const canUseAuction = (state: GameState) =>
  !state.battle && !state.dungeon && Boolean(towns[state.locationTownId]?.services.includes("auction"));
export const minimumBid = (listing: AuctionListing) => listing.currentBid + (listing.bidderId ? 1 : 0);
const fail = (state: GameState, text: string): GameState => ({
  ...state, log: [{ text, tone: "danger" as const }, ...state.log].slice(0, 8)
});

/** Old records had no clock marker. Preserve escrow and give open lots a full tick window. */
export const migrateAuctionClock = (state: GameState, tick: number): GameState => ({
  ...state,
  auctionListings: (state.auctionListings ?? []).map((lot) => lot.townId ? lot : {
    ...lot, townId: legacyTown, closesAt: tick + auctionDuration,
    bidderId: !lot.settled && lot.bidderId !== "player" && !lot.fundedNpcBid ? undefined : lot.bidderId
  })
});

export const listAtAuction = (state: GameState, selector: string, opening: number, tick: number): GameState => {
  if (!canUseAuction(state)) return fail(state, "競売所でのみ出品できます。");
  const next = createAuctionListing(state, selector, opening, tick + auctionDuration);
  if (next.auctionListings === state.auctionListings) return next;
  return { ...next, auctionListings: next.auctionListings.map((lot, index) =>
    index === next.auctionListings.length - 1 ? { ...lot, townId: state.locationTownId } : lot) };
};

export const bidAtAuction = (state: GameState, id: string, bid: number, tick: number, simulation: NpcSimulationState) => {
  const lot = state.auctionListings.find((entry) => entry.id === id);
  if (!canUseAuction(state) || lot?.townId !== state.locationTownId || lot.settled || tick >= lot.closesAt) {
    return { state: fail(state, "この競売には入札できません。"), simulation };
  }
  const next = bidOnAuction(state, id, bid);
  if (next.auctionListings === state.auctionListings || !lot.fundedNpcBid) return { state: next, simulation };
  return {
    state: { ...next, auctionListings: next.auctionListings.map((entry) => entry.id === id ? { ...entry, fundedNpcBid: undefined } : entry) },
    simulation: { ...simulation, npcs: simulation.npcs.map((npc) => npc.npcId === lot.bidderId ? { ...npc, gold: npc.gold + lot.currentBid } : npc) }
  };
};

/** Run once after an action advances the NPC clock; never from a timer or on reload. */
export const advanceAuction = (state: GameState, simulation: NpcSimulationState) => {
  const tick = simulation.tick;
  const events: string[] = [];
  let actors = simulation.npcs;
  for (const lot of state.auctionListings) {
    if (lot.settled || !lot.townId || tick < lot.closesAt) continue;
    state = settleAuction(state, lot.id, tick);
    if (lot.sellerId !== "player") {
      actors = actors.map((npc) => npc.npcId !== lot.sellerId ? npc : lot.bidderId
        ? { ...npc, gold: npc.gold + lot.currentBid }
        : { ...npc, inventory: addInventoryItem(npc.inventory, lot.item) });
      const sellerName = npcs[lot.sellerId]?.name ?? "旅人";
      events.push(lot.bidderId
        ? `${sellerName}は${itemLabel(lot.item)}の売上${lot.currentBid}文を受け取った。`
        : `${sellerName}に${itemLabel(lot.item)}が返却された。`);
    }
    if (lot.fundedNpcBid && lot.bidderId) {
      actors = actors.map((npc) => npc.npcId === lot.bidderId ? { ...npc, inventory: addInventoryItem(npc.inventory, lot.item) } : npc);
      events.push(`${npcs[lot.bidderId]?.name ?? lot.bidderId}は${itemLabel(lot.item)}を${lot.currentBid}文で落札した。`);
    }
  }
  // Only one autonomous bid per tick. Existing gear and crafting outputs are eligible.
  const buyer = actors.find((npc) => npcs[npc.npcId]?.goal === "trade" && !npc.dungeonId && !npc.defeated);
  const candidate = buyer && state.auctionListings.find((lot) =>
    lot.sellerId === "player" && !lot.settled && !lot.bidderId && lot.townId === buyer.townId &&
    tick < lot.closesAt && tick === lot.closesAt - 2 &&
    lot.currentBid <= buyer.gold && lot.currentBid <= (items[lot.item.id]?.value ?? 0));
  if (buyer && candidate) {
    state = bidOnAuction(state, candidate.id, candidate.currentBid, buyer.npcId);
    state = { ...state, auctionListings: state.auctionListings.map((lot) => lot.id === candidate.id ? { ...lot, fundedNpcBid: true } : lot) };
    actors = actors.map((npc) => npc === buyer ? { ...npc, gold: npc.gold - candidate.currentBid } : npc);
    events.push(`${npcs[buyer.npcId].name}は${itemLabel(candidate.item)}に${candidate.currentBid}文で入札した。`);
  }
  // One open NPC lot at a time, from real surplus stock at the auction town.
  const seller = actors.find((npc) => npcs[npc.npcId]?.goal === "trade" && !npc.dungeonId && !npc.defeated && towns[npc.townId]?.services.includes("auction"));
  const surplus = seller?.inventory.find((entry) => items[entry.id]?.kind === "material" && entry.quantity >= 2 && !entry.instanceId);
  if (seller && surplus && !state.auctionListings.some((lot) => lot.sellerId === seller.npcId && (!lot.settled || lot.closesAt === tick))) {
    const id = `npc-lot-${seller.npcId}-${tick}`;
    if (!state.auctionListings.some((lot) => lot.id === id)) {
      const currentBid = Math.max(1, state.economy.quotes[surplus.id]?.currentPrice ?? items[surplus.id].value);
      state = { ...state, auctionListings: [...state.auctionListings, {
        id, sellerId: seller.npcId, item: { ...surplus, quantity: 1 }, currentBid,
        closesAt: tick + auctionDuration, settled: false, townId: seller.townId
      }] };
      actors = actors.map((npc) => npc === seller ? { ...npc, inventory: removeInventoryItem(npc.inventory, surplus.id) } : npc);
      events.push(`${npcs[seller.npcId].name}は${itemLabel(surplus)}を競売へ出品した。`);
    }
  }
  return { state, simulation: { ...simulation, npcs: actors, events: [...simulation.events, ...events].slice(-24) } };
};
