import { afterEach, expect, it, vi } from "vitest";
import { advanceAuction, bidAtAuction, listAtAuction, migrateAuctionClock } from "../src/game/auction";
import { npcMarketCash } from "../src/game/economy";
import { initialState } from "../src/game/engine";
import { createNpcStates, simulateNpcEconomyTick } from "../src/game/npc";
import { createBrowserStorage } from "../src/game/persistence";
import { renderApp } from "../src/ui/view";

const port = () => ({ ...initialState(), locationTownId: "mist_port" });
const world = (tick = 0) => ({ tick, npcs: createNpcStates().filter((npc) => npc.npcId === "fumi"), events: [] });
const ore = { id: "iron_ore", quantity: 2 };
afterEach(() => vi.unstubAllGlobals());

it("moves just the exact enhanced copy into escrow and prevents duplicate or equipped listings", () => {
  const state = port();
  state.inventory.push({ id: "field_iron_blade", quantity: 1, instanceId: "blade-a", enhancement: 1 },
    { id: "field_iron_blade", quantity: 1, instanceId: "blade-b", enhancement: 3 });
  expect(listAtAuction(state, "starter-weapon", 1, 0).auctionListings).toHaveLength(0);
  expect(listAtAuction(initialState(), "iron_ore", 1, 0).auctionListings).toHaveLength(0);
  const listed = listAtAuction(state, "blade-b", 7, 0);
  expect(listed.inventory.some((item) => item.instanceId === "blade-b")).toBe(false);
  expect(listed.inventory.some((item) => item.instanceId === "blade-a")).toBe(true);
  expect(listAtAuction(listed, "blade-b", 7, 0).auctionListings).toHaveLength(1);
  expect(renderApp(listed, "town", false, world())).toContain("野鉄の刀 +3");
  expect(advanceAuction(listed, world(6)).state.inventory).toContainEqual(listed.auctionListings[0].item);
});

it("reserves NPC bids and pays the player exactly once, without minting money", () => {
  const listed = listAtAuction(port(), "iron_ore", 5, 0);
  const before = world(4);
  const reserved = advanceAuction(listed, before);
  expect(reserved.simulation.npcs[0].gold).toBe(before.npcs[0].gold - 5);
  expect(reserved.simulation.events.join()).toContain("入札");
  const paid = advanceAuction(reserved.state, { ...reserved.simulation, tick: 6 });
  expect(paid.state.gold).toBe(listed.gold + 5);
  expect(paid.simulation.npcs[0].inventory).toContainEqual({ ...ore, quantity: 1 });
  expect(advanceAuction(paid.state, paid.simulation).state.gold).toBe(paid.state.gold);
});

it("lists real NPC stock, blocks invalid bids and delivers the paid item only at deadline", () => {
  const before = world();
  before.npcs[0].inventory = [ore];
  const offered = advanceAuction(port(), before);
  const [lot] = offered.state.auctionListings;
  expect(offered.simulation.npcs[0].inventory[0].quantity).toBe(1);
  expect(bidAtAuction(offered.state, lot.id, 999, 0, offered.simulation).state.gold).toBe(40);
  expect(bidAtAuction(offered.state, lot.id, lot.currentBid, 6, offered.simulation).state.gold).toBe(40);
  const own = listAtAuction(port(), "iron_ore", 5, 0);
  expect(bidAtAuction(own, own.auctionListings[0].id, 6, 0, before).state.gold).toBe(40);
  const bid = bidAtAuction(offered.state, lot.id, lot.currentBid, 0, offered.simulation);
  expect(bid.state.gold).toBe(40 - lot.currentBid);
  expect(bid.state.inventory).toEqual(offered.state.inventory);
  const paid = advanceAuction(bid.state, { ...bid.simulation, tick: 6 });
  expect(paid.simulation.npcs[0].gold).toBe(before.npcs[0].gold + lot.currentBid);
  expect(paid.state.inventory.find((item) => item.id === "iron_ore")?.quantity).toBe(3);
  const returned = advanceAuction(offered.state, { ...offered.simulation, tick: 6 });
  expect(returned.simulation.npcs[0].inventory[0].quantity).toBe(2);
});

it("preserves a funded bid and its tick in a single save snapshot", () => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key), setItem: (key: string, value: string) => data.set(key, value) });
  const reserved = advanceAuction(listAtAuction(port(), "iron_ore", 5, 0), world(4));
  const storage = createBrowserStorage();
  storage.save(reserved.state, reserved.simulation);
  expect(storage.loadSimulation()).toEqual(reserved.simulation);
  expect(storage.load()?.auctionListings).toEqual(reserved.state.auctionListings);
  const legacy = { ...reserved.state, auctionListings: reserved.state.auctionListings.map((lot) => ({ ...lot, townId: undefined, fundedNpcBid: undefined, bidderId: "player", closesAt: 1_800_000_000_000 })) };
  expect(migrateAuctionClock(legacy, 10).auctionListings[0]).toMatchObject({ closesAt: 16, bidderId: "player", townId: "mist_port" });
});

it("refunds displaced escrow and charges only the difference on a raised own bid", () => {
  const simulation = world();
  const initial = port();
  const lot = { id: "competing-lot", townId: "mist_port", sellerId: "jin", item: { id: "iron_ore", quantity: 1 },
    currentBid: 5, bidderId: "fumi", fundedNpcBid: true, closesAt: 6, settled: false };
  const outbid = bidAtAuction({ ...initial, auctionListings: [lot] }, lot.id, 6, 1, simulation);
  expect(outbid.simulation.npcs[0].gold).toBe(simulation.npcs[0].gold + 5);
  expect(outbid.state.gold).toBe(34);
  const raised = bidAtAuction(outbid.state, lot.id, 8, 2, outbid.simulation);
  expect(raised.state.gold).toBe(32);
  expect(raised.simulation.npcs[0].gold).toBe(outbid.simulation.npcs[0].gold);
});

it("moves NPC shop money and stock in opposite directions and protects equipped items", () => {
  const start = world();
  const base = port().economy;
  const bought = simulateNpcEconomyTick(start, base);
  const npc = bought.simulation.npcs[0];
  expect(npc.inventory).toContainEqual(npc.equipment.weapon);
  expect(bought.economy.quotes.bamboo_sword.supply).toBe(base.quotes.bamboo_sword.supply - 1);
  expect(npc.gold + npcMarketCash(bought.economy)).toBe(start.npcs[0].gold + npcMarketCash(base));
  const sold = simulateNpcEconomyTick({ ...bought.simulation, npcs: [{ ...npc, inventory: [...npc.inventory, { id: "spirit_dew", quantity: 2 }] }] }, bought.economy);
  expect(sold.economy.quotes.spirit_dew.supply).toBe(base.quotes.spirit_dew.supply + 1);
  expect(sold.simulation.npcs[0].inventory).toContainEqual(npc.equipment.weapon);
  expect(sold.simulation.npcs[0].gold + npcMarketCash(sold.economy)).toBe(npc.gold + npcMarketCash(bought.economy));
});
