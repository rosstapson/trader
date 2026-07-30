import { z } from "zod";

export const watchlistSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
});
export type Watchlist = z.infer<typeof watchlistSchema>;

export const watchlistItemQuoteSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  shares: z.string().nullable(),
  addedAt: z.string(),
  price: z.string().nullable(),
  changePercent: z.string().nullable(),
  changeAbs: z.string().nullable(),
  /** shares × price, only present when shares is set and the quote succeeded */
  positionValue: z.string().nullable(),
  /** shares × changeAbs, only present when shares is set and the quote succeeded */
  positionDayGainLoss: z.string().nullable(),
  /** set instead of price/change fields when this symbol's quote failed to load, so one bad symbol doesn't fail the whole list */
  quoteError: z.string().optional(),
});
export type WatchlistItemQuote = z.infer<typeof watchlistItemQuoteSchema>;

export const watchlistDetailSchema = watchlistSchema.extend({
  items: z.array(watchlistItemQuoteSchema),
  totalPositionValue: z.string().nullable(),
  totalDayGainLoss: z.string().nullable(),
});
export type WatchlistDetail = z.infer<typeof watchlistDetailSchema>;

export const createWatchlistRequestSchema = z.object({ name: z.string().min(1).max(100) });
export type CreateWatchlistRequest = z.infer<typeof createWatchlistRequestSchema>;

export const renameWatchlistRequestSchema = z.object({ name: z.string().min(1).max(100) });
export type RenameWatchlistRequest = z.infer<typeof renameWatchlistRequestSchema>;

export const addWatchlistItemRequestSchema = z.object({ symbol: z.string().min(1).max(20) });
export type AddWatchlistItemRequest = z.infer<typeof addWatchlistItemRequestSchema>;

export const updateWatchlistItemSharesRequestSchema = z.object({
  shares: z.number().nonnegative().nullable(),
});
export type UpdateWatchlistItemSharesRequest = z.infer<typeof updateWatchlistItemSharesRequestSchema>;
