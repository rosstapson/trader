import type {
  CompanySearchResult,
  Quote,
  Financials,
  NewsItem,
  CompanyProfile,
  DividendEvent,
  PricePoint,
  CashFlowSummary,
  EarningsInfo,
} from "@trader/shared";
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

  /** Runs `task` through the shared pacing queue so every endpoint — JSON or CSV — respects the same rate limit. */
  private schedule<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task, task);
    // Advance the queue unconditionally so one failed call doesn't wedge every call after it.
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private buildUrl(params: Record<string, string>): URL {
    const url = new URL(BASE_URL);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("apikey", this.apiKey);
    return url;
  }

  private async pace(): Promise<void> {
    const wait = this.lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
  }

  private request<T>(params: Record<string, string>): Promise<T> {
    return this.schedule(async () => {
      await this.pace();

      let res: Response;
      try {
        res = await fetch(this.buildUrl(params));
      } catch (err) {
        throw new MarketDataError("Alpha Vantage request failed", this.name, err);
      }
      if (!res.ok) {
        throw new MarketDataError(`Alpha Vantage HTTP ${res.status}`, this.name);
      }
      const json = (await res.json()) as Record<string, unknown>;
      if (json["Note"] || json["Information"]) {
        throw new MarketDataError(String(json["Note"] ?? json["Information"]), this.name);
      }
      return json as T;
    });
  }

  /** A handful of endpoints (EARNINGS_CALENDAR) return CSV instead of JSON. */
  private requestCsv(params: Record<string, string>): Promise<string> {
    return this.schedule(async () => {
      await this.pace();

      let res: Response;
      try {
        res = await fetch(this.buildUrl(params));
      } catch (err) {
        throw new MarketDataError("Alpha Vantage request failed", this.name, err);
      }
      if (!res.ok) {
        throw new MarketDataError(`Alpha Vantage HTTP ${res.status}`, this.name);
      }
      return res.text();
    });
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
      sharesOutstanding: num(data.SharesOutstanding),
    };
  }

  async getDividendHistory(symbol: string): Promise<DividendEvent[]> {
    const data = await this.request<{
      data?: { ex_dividend_date: string; payment_date?: string; amount: string }[];
    }>({
      function: "DIVIDENDS",
      symbol,
    });
    return (data.data ?? [])
      .filter((d) => d.amount && d.amount !== "None")
      .sort((a, b) => b.ex_dividend_date.localeCompare(a.ex_dividend_date))
      .slice(0, 20)
      .map((d) => ({
        exDividendDate: d.ex_dividend_date,
        paymentDate: d.payment_date && d.payment_date !== "None" ? d.payment_date : null,
        amount: d.amount,
      }));
  }

  async getPriceHistory(symbol: string): Promise<PricePoint[]> {
    const data = await this.request<{
      "Time Series (Daily)"?: Record<string, { "4. close": string }>;
    }>({
      function: "TIME_SERIES_DAILY",
      symbol,
      outputsize: "compact",
    });
    const series = data["Time Series (Daily)"] ?? {};
    return Object.entries(series)
      .map(([date, values]) => ({ date, close: values["4. close"] }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getCashFlow(symbol: string): Promise<CashFlowSummary> {
    const data = await this.request<{
      annualReports?: { fiscalDateEnding: string; operatingCashflow?: string; capitalExpenditures?: string }[];
    }>({
      function: "CASH_FLOW",
      symbol,
    });
    const latest = data.annualReports?.[0];
    if (!latest) {
      return { symbol, freeCashFlow: null, fiscalDateEnding: null };
    }

    const operating = latest.operatingCashflow && latest.operatingCashflow !== "None" ? Number(latest.operatingCashflow) : null;
    const capex = latest.capitalExpenditures && latest.capitalExpenditures !== "None" ? Number(latest.capitalExpenditures) : null;
    const freeCashFlow = operating !== null && capex !== null ? String(operating - capex) : null;

    return { symbol, freeCashFlow, fiscalDateEnding: latest.fiscalDateEnding ?? null };
  }

  async getNextEarnings(symbol: string): Promise<EarningsInfo> {
    const csv = await this.requestCsv({ function: "EARNINGS_CALENDAR", symbol, horizon: "3month" });
    const lines = csv.trim().split("\n").filter(Boolean);
    if (lines.length < 2) {
      return { symbol, nextReportDate: null, estimate: null };
    }

    const header = lines[0]!.split(",");
    const reportDateIdx = header.indexOf("reportDate");
    const estimateIdx = header.indexOf("estimate");
    // Rows are already sorted by reportDate ascending; the first data row is the nearest upcoming date.
    const firstRow = lines[1]!.split(",");

    return {
      symbol,
      nextReportDate: reportDateIdx >= 0 ? firstRow[reportDateIdx] || null : null,
      estimate: estimateIdx >= 0 ? firstRow[estimateIdx] || null : null,
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
