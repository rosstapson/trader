import type { CompanySearchResult, Quote, Financials, NewsItem, CompanyProfile } from "@trader/shared";
import type { MarketDataProvider } from "../provider.js";
import { MarketDataError } from "../provider.js";

const BASE_URL = "https://www.alphavantage.co/query";
// Free tier rejects bursts faster than ~1/sec even though the daily cap is separate.
const MIN_REQUEST_INTERVAL_MS = 1100;

/**
 * Free-tier adapter. CachedMarketDataProvider (see cached.ts) is the primary defense
 * against the daily quota; the two things handled here — request pacing and coalescing
 * concurrent OVERVIEW calls — exist because a *single* company overview page load
 * fires getProfile/getQuote/getFinancials/getNews in parallel (see apps/api's
 * fetchOverview), which would otherwise blow the per-second burst limit and double up
 * on the OVERVIEW endpoint (both getProfile and getFinancials read from it) before the
 * cache ever gets a chance to help.
 */
export class AlphaVantageProvider implements MarketDataProvider {
  readonly name = "alpha-vantage";

  private queue: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;
  private pendingOverview = new Map<string, Promise<Record<string, string>>>();

  constructor(private readonly apiKey: string) {}

  private request<T>(params: Record<string, string>): Promise<T> {
    const result = this.queue.then(
      () => this.doRequest<T>(params),
      () => this.doRequest<T>(params),
    );
    // Advance the queue unconditionally so one failed call doesn't wedge every call after it.
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async doRequest<T>(params: Record<string, string>): Promise<T> {
    const wait = this.lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();

    const url = new URL(BASE_URL);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("apikey", this.apiKey);

    const res = await fetch(url);
    if (!res.ok) {
      throw new MarketDataError(`Alpha Vantage HTTP ${res.status}`, this.name);
    }
    const json = (await res.json()) as Record<string, unknown>;
    if (json["Note"] || json["Information"]) {
      throw new MarketDataError(
        String(json["Note"] ?? json["Information"]),
        this.name,
      );
    }
    return json as T;
  }

  /** getProfile and getFinancials both read the OVERVIEW endpoint; coalesce concurrent calls into one request. */
  private fetchOverviewRaw(symbol: string): Promise<Record<string, string>> {
    const existing = this.pendingOverview.get(symbol);
    if (existing) return existing;

    const promise = this.request<Record<string, string>>({ function: "OVERVIEW", symbol }).finally(() => {
      this.pendingOverview.delete(symbol);
    });
    this.pendingOverview.set(symbol, promise);
    return promise;
  }

  async search(query: string): Promise<CompanySearchResult[]> {
    const data = await this.request<{ bestMatches?: Record<string, string>[] }>({
      function: "SYMBOL_SEARCH",
      keywords: query,
    });
    return (data.bestMatches ?? []).map((m) => ({
      symbol: m["1. symbol"] ?? "",
      name: m["2. name"] ?? "",
      assetType: m["3. type"],
      exchange: m["4. region"],
    }));
  }

  async getProfile(symbol: string): Promise<CompanyProfile> {
    const data = await this.fetchOverviewRaw(symbol);
    return {
      symbol,
      name: data.Name || symbol,
      description: data.Description || undefined,
      sector: data.Sector || undefined,
      industry: data.Industry || undefined,
      exchange: data.Exchange || undefined,
    };
  }

  async getQuote(symbol: string): Promise<Quote> {
    const data = await this.request<{ "Global Quote"?: Record<string, string> }>({
      function: "GLOBAL_QUOTE",
      symbol,
    });
    const q = data["Global Quote"];
    if (!q || !q["05. price"]) {
      throw new MarketDataError(`No quote data for ${symbol}`, this.name);
    }
    return {
      symbol,
      price: q["05. price"],
      change: q["09. change"] ?? "0",
      changePercent: (q["10. change percent"] ?? "0%").replace("%", ""),
      asOf: q["07. latest trading day"]
        ? new Date(q["07. latest trading day"]).toISOString()
        : new Date().toISOString(),
    };
  }

  async getFinancials(symbol: string): Promise<Financials> {
    const data = await this.fetchOverviewRaw(symbol);
    const num = (v: string | undefined) => (v && v !== "None" ? v : null);
    return {
      symbol,
      fiscalYearEnd: data.FiscalYearEnd || undefined,
      peRatio: num(data.PERatio),
      eps: num(data.EPS),
      dividendPerShare: num(data.DividendPerShare),
      dividendYield: num(data.DividendYield),
      marketCap: num(data.MarketCapitalization),
      revenueTtm: num(data.RevenueTTM),
      profitMargin: num(data.ProfitMargin),
    };
  }

  async getNews(symbol: string): Promise<NewsItem[]> {
    const data = await this.request<{
      feed?: { title: string; url: string; source: string; time_published: string; summary?: string }[];
    }>({
      function: "NEWS_SENTIMENT",
      tickers: symbol,
      limit: "20",
    });
    return (data.feed ?? []).map((item) => ({
      title: item.title,
      url: item.url,
      source: item.source,
      publishedAt: parseAlphaVantageTimestamp(item.time_published),
      summary: item.summary,
    }));
  }
}

function parseAlphaVantageTimestamp(raw: string): string {
  // Format: YYYYMMDDTHHMMSS
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(raw);
  if (!match) return new Date().toISOString();
  const [, y, mo, d, h, mi, s] = match;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
}
