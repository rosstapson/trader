import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { Decimal } from "decimal.js";
import { db, watchlists, watchlistItems, companies } from "@trader/db";
import {
  createWatchlistRequestSchema,
  renameWatchlistRequestSchema,
  addWatchlistItemRequestSchema,
  updateWatchlistItemSharesRequestSchema,
  type Quote,
  type WatchlistItemQuote,
} from "@trader/shared";
import { getMarketDataProvider } from "../providers.js";
import { getDefaultUserId } from "../user.js";
import { upsertCompanyProfile } from "../services/company-cache.js";

export const watchlistsRouter: Router = Router();

const idParamSchema = z.object({ id: z.string().uuid() });
const itemParamsSchema = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });

watchlistsRouter.get("/", async (_req, res, next) => {
  try {
    const userId = await getDefaultUserId();
    const rows = await db.select().from(watchlists).where(eq(watchlists.userId, userId));
    res.json(rows.map((w) => ({ id: w.id, name: w.name, createdAt: w.createdAt.toISOString() })));
  } catch (err) {
    next(err);
  }
});

watchlistsRouter.post("/", async (req, res, next) => {
  try {
    const { name } = createWatchlistRequestSchema.parse(req.body);
    const userId = await getDefaultUserId();
    const [created] = await db.insert(watchlists).values({ userId, name }).returning();
    if (!created) throw new Error("Failed to create watchlist");
    res.status(201).json({ id: created.id, name: created.name, createdAt: created.createdAt.toISOString() });
  } catch (err) {
    next(err);
  }
});

watchlistsRouter.patch("/:id", async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { name } = renameWatchlistRequestSchema.parse(req.body);
    const userId = await getDefaultUserId();

    const [updated] = await db
      .update(watchlists)
      .set({ name })
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Watchlist not found" });
      return;
    }
    res.json({ id: updated.id, name: updated.name, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    next(err);
  }
});

watchlistsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = await getDefaultUserId();

    const [deleted] = await db
      .delete(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "not_found", message: "Watchlist not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

async function loadItemQuote(
  item: { id: string; symbol: string; shares: string | null; addedAt: Date },
  name: string,
): Promise<WatchlistItemQuote> {
  let quote: Quote | undefined;
  let quoteError: string | undefined;
  try {
    quote = await getMarketDataProvider().getQuote(item.symbol);
  } catch (err) {
    quoteError = err instanceof Error ? err.message : "Quote unavailable";
  }

  const shares = item.shares ? new Decimal(item.shares) : null;
  const price = quote ? new Decimal(quote.price) : null;
  const changeAbs = quote ? new Decimal(quote.change) : null;

  return {
    id: item.id,
    symbol: item.symbol,
    name,
    shares: item.shares,
    addedAt: item.addedAt.toISOString(),
    price: quote?.price ?? null,
    changePercent: quote?.changePercent ?? null,
    changeAbs: quote?.change ?? null,
    positionValue: shares && price ? shares.mul(price).toFixed(2) : null,
    positionDayGainLoss: shares && changeAbs ? shares.mul(changeAbs).toFixed(2) : null,
    quoteError,
  };
}

watchlistsRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = await getDefaultUserId();

    const [watchlist] = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
      .limit(1);
    if (!watchlist) {
      res.status(404).json({ error: "not_found", message: "Watchlist not found" });
      return;
    }

    const rows = await db
      .select({ item: watchlistItems, companyName: companies.name })
      .from(watchlistItems)
      .innerJoin(companies, eq(watchlistItems.symbol, companies.symbol))
      .where(eq(watchlistItems.watchlistId, id));

    const items = await Promise.all(rows.map((r) => loadItemQuote(r.item, r.companyName)));

    let totalValue: Decimal | null = null;
    let totalGainLoss: Decimal | null = null;
    for (const item of items) {
      if (item.positionValue) totalValue = (totalValue ?? new Decimal(0)).plus(item.positionValue);
      if (item.positionDayGainLoss) totalGainLoss = (totalGainLoss ?? new Decimal(0)).plus(item.positionDayGainLoss);
    }

    res.json({
      id: watchlist.id,
      name: watchlist.name,
      createdAt: watchlist.createdAt.toISOString(),
      items,
      totalPositionValue: totalValue?.toFixed(2) ?? null,
      totalDayGainLoss: totalGainLoss?.toFixed(2) ?? null,
    });
  } catch (err) {
    next(err);
  }
});

watchlistsRouter.post("/:id/items", async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { symbol: rawSymbol } = addWatchlistItemRequestSchema.parse(req.body);
    const symbol = rawSymbol.toUpperCase();
    const userId = await getDefaultUserId();

    const [watchlist] = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
      .limit(1);
    if (!watchlist) {
      res.status(404).json({ error: "not_found", message: "Watchlist not found" });
      return;
    }

    // watchlist_items.symbol has a FK to companies.symbol — make sure the reference row exists.
    const profile = await getMarketDataProvider().getProfile(symbol);
    await upsertCompanyProfile(profile);

    const [created] = await db
      .insert(watchlistItems)
      .values({ watchlistId: id, symbol })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      res.status(409).json({ error: "already_added", message: `${symbol} is already on this watchlist` });
      return;
    }

    res.status(201).json(await loadItemQuote(created, profile.name));
  } catch (err) {
    next(err);
  }
});

watchlistsRouter.patch("/:id/items/:itemId", async (req, res, next) => {
  try {
    const { id, itemId } = itemParamsSchema.parse(req.params);
    const { shares } = updateWatchlistItemSharesRequestSchema.parse(req.body);
    const userId = await getDefaultUserId();

    const [watchlist] = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
      .limit(1);
    if (!watchlist) {
      res.status(404).json({ error: "not_found", message: "Watchlist not found" });
      return;
    }

    const [updated] = await db
      .update(watchlistItems)
      .set({ shares: shares === null ? null : shares.toString() })
      .where(and(eq(watchlistItems.id, itemId), eq(watchlistItems.watchlistId, id)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Watchlist item not found" });
      return;
    }

    const [company] = await db.select().from(companies).where(eq(companies.symbol, updated.symbol)).limit(1);
    res.json(await loadItemQuote(updated, company?.name ?? updated.symbol));
  } catch (err) {
    next(err);
  }
});

watchlistsRouter.delete("/:id/items/:itemId", async (req, res, next) => {
  try {
    const { id, itemId } = itemParamsSchema.parse(req.params);
    const userId = await getDefaultUserId();

    const [watchlist] = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId)))
      .limit(1);
    if (!watchlist) {
      res.status(404).json({ error: "not_found", message: "Watchlist not found" });
      return;
    }

    const [deleted] = await db
      .delete(watchlistItems)
      .where(and(eq(watchlistItems.id, itemId), eq(watchlistItems.watchlistId, id)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "not_found", message: "Watchlist item not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
