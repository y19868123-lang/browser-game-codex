import { items } from "../data/items";
import type { EconomyState, MarketQuote } from "./types";

export const createEconomy = (): EconomyState => ({
  listingsEnabled: false,
  quotes: Object.fromEntries(Object.values(items).map((item) => [item.id, { itemId: item.id, basePrice: item.value, currentPrice: item.value, supply: 8, demand: 8 }]))
});

export const priceFor = (economy: EconomyState, itemId: string, townMultiplier = 1): number => Math.ceil((economy.quotes[itemId]?.currentPrice ?? 0) * townMultiplier);

/** Records finite market activity. Server ticks can call this for both players and NPCs. */
export const recordMarketTrade = (economy: EconomyState, itemId: string, side: "buy" | "sell", quantity: number): EconomyState => {
  const quote = economy.quotes[itemId];
  if (!quote || quantity < 1) return economy;
  const supply = Math.max(0, quote.supply + (side === "sell" ? quantity : -quantity));
  const demand = Math.max(0, quote.demand + (side === "buy" ? quantity : -quantity));
  const pressure = Math.max(-0.3, Math.min(0.5, (demand - supply) / Math.max(10, supply + demand)));
  const currentPrice = Math.max(1, Math.round(quote.basePrice * (1 + pressure)));
  const nextQuote: MarketQuote = { ...quote, supply, demand, currentPrice };
  return { ...economy, quotes: { ...economy.quotes, [itemId]: nextQuote } };
};
