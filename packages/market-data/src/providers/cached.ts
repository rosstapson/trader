import { eq } from "drizzle-orm";
import type { Db } from "@trader/db";
import { marketDataCache } from "@trader/db";
import type { CompanySearchResult, Quote, Financials, NewsItem, CompanyProfile } from "@trader/shared";
import type { MarketDataProvider } from "../provider.js";

const TTL_MS = {
  search: 24 * 60 * 60 * 1000, // company search results rarely change
  profile: 24 * 60 * 60 * 1000, // sector/description/etc. change rarely
  quote: 15 * 60 * 1000, // price is the most volatile thing we cache
  financials: 24 * 60 * 60 * 1000, // fundamentals update quarterly at most
  news: 60 * 60 * 1000,
} as const;

/**
 * Decorates any MarketDataProvider with a Postgres-backed cache. This is the primary
 * mitigation for free-tier rate limits (see ARCHITECTURE.md §7.1) — it exists
 * independent of which underlying provider is active.
 */
export class CachedMarketDataProvider implements MarketDataProvider {
  readonly name: string;

  constructor(
    private readonly inner: MarketDataProvider,
    private readonly db: Db,
  ) {
    this.name = `cached(${inner.name})`;
  }

  private async cached<T>(kind: keyof typeof TTL_MS, key: string, fetcher: () => Promise<T>): Promise<T> {
    const cacheKey = `${this.inner.name}:${kind}:${key}`;
    const [hit] = await this.db
      .select()
      .from(marketDataCache)
      .where(eq(marketDataCache.cacheKey, cacheKey))
      .limit(1);

    if (hit && hit.expiresAt > new Date()) {
      return hit.payload as T;
    }

    const fresh = await fetcher();
    const expiresAt = new Date(Date.now() + TTL_MS[kind]);

    await this.db
      .insert(marketDataCache)
      .values({ cacheKey, provider: this.inner.name, payload: fresh as object, expiresAt })
      .onConflictDoUpdate({
        target: marketDataCache.cacheKey,
        set: { payload: fresh as object, fetchedAt: new Date(), expiresAt },
      });

    return fresh;
  }

  search(query: string): Promise<CompanySearchResult[]> {
    return this.cached("search", query.toLowerCase(), () => this.inner.search(query));
  }

  getProfile(symbol: string): Promise<CompanyProfile> {
    return this.cached("profile", symbol, () => this.inner.getProfile(symbol));
  }

  getQuote(symbol: string): Promise<Quote> {
    return this.cached("quote", symbol, () => this.inner.getQuote(symbol));
  }

  getFinancials(symbol: string): Promise<Financials> {
    return this.cached("financials", symbol, () => this.inner.getFinancials(symbol));
  }

  getNews(symbol: string): Promise<NewsItem[]> {
    return this.cached("news", symbol, () => this.inner.getNews(symbol));
  }
}
