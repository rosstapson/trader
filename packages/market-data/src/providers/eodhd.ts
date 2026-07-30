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

const BASE_URL = "https://eodhd.com/api";

interface EodhdSearchResult {
  Code: string;
  Exchange: string;
  Name: string;
  Type?: string;
  Country?: string;
}

interface EodhdQuote {
  code: string;
  timestamp: number;
  close: number;
  previousClose: number;
  change: number;
  change_p: number;
}

interface EodhdFundamentals {
  General?: {
    Code?: string;
    Name?: string;
    Exchange?: string;
    Sector?: string;
    Industry?: string;
    Description?: string;
    FiscalYearEnd?: string;
  };
  Highlights?: {
    MarketCapitalization?: number;
    PERatio?: number;
    EarningsShare?: number;
    DividendShare?: number;
    DividendYield?: number;
    RevenueTTM?: number;
    ProfitMargin?: number;
  };
  SharesStats?: {
    SharesOutstanding?: number;
  };
  Financials?: {
    Cash_Flow?: {
      // EODHD returns this as an object keyed by report date in practice, not always
      // the array the public OpenAPI schema implies — handle both.
      annual?: Record<string, EodhdCashFlowRow> | EodhdCashFlowRow[];
    };
  };
}

interface EodhdCashFlowRow {
  date?: string;
  totalCashFromOperatingActivities?: string | number;
  capitalExpenditures?: string | number;
}

interface EodhdDividend {
  date: string;
  paymentDate?: string | null;
  value: number;
}

interface EodhdEodPoint {
  date: string;
  close: number;
}

interface EodhdNewsItem {
  date: string;
  title: string;
  content?: string;
  link: string;
}

interface EodhdEarningsEntry {
  code: string;
  report_date: string;
  estimate?: number;
}

/**
 * Paid provider with much broader exchange coverage than the free Alpha Vantage adapter —
 * notably mainland China (Shanghai/Shenzhen, symbol suffixes .SHG/.SHE) and Hong Kong (.HK),
 * which Alpha Vantage's free tier barely reaches. Selected via MARKET_DATA_PROVIDER=eodhd.
 *
 * EODHD's rate limits are generous compared to Alpha Vantage's 25/day free cap, so this
 * adapter doesn't need the request-pacing queue AlphaVantageProvider has. It still coalesces
 * concurrent /fundamentals calls (getProfile/getFinancials/getCashFlow all read it) since
 * that's a real efficiency win regardless of quota pressure.
 *
 * Symbols are EODHD's own "CODE.EXCHANGE" format (e.g. "AAPL.US", "600519.SHG") — search()
 * returns symbols already in that shape, and callers should pass them straight through to
 * every other method unchanged.
 */
export class EODHDProvider implements MarketDataProvider {
  readonly name = "eodhd";

  private pendingFundamentals = new Map<string, Promise<EodhdFundamentals>>();

  constructor(private readonly apiKey: string) {}

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set("api_token", this.apiKey);
    url.searchParams.set("fmt", "json");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new MarketDataError("EODHD request failed", this.name, err);
    }
    if (!res.ok) {
      throw new MarketDataError(`EODHD HTTP ${res.status}`, this.name);
    }
    return (await res.json()) as T;
  }

  /** getProfile/getFinancials/getCashFlow all read the same endpoint; coalesce concurrent calls. */
  private fetchFundamentals(symbol: string): Promise<EodhdFundamentals> {
    const existing = this.pendingFundamentals.get(symbol);
    if (existing) return existing;

    const promise = this.request<EodhdFundamentals>(`/fundamentals/${encodeURIComponent(symbol)}`).finally(() => {
      this.pendingFundamentals.delete(symbol);
    });
    this.pendingFundamentals.set(symbol, promise);
    return promise;
  }

  async search(query: string): Promise<CompanySearchResult[]> {
    const results = await this.request<EodhdSearchResult[]>(`/search/${encodeURIComponent(query)}`);
    return results.map((r) => ({
      symbol: `${r.Code}.${r.Exchange}`,
      name: r.Name,
      exchange: r.Exchange,
      assetType: r.Type,
    }));
  }

  async getProfile(symbol: string): Promise<CompanyProfile> {
    const data = await this.fetchFundamentals(symbol);
    const g = data.General;
    return {
      symbol,
      name: g?.Name || symbol,
      description: g?.Description || undefined,
      sector: g?.Sector || undefined,
      industry: g?.Industry || undefined,
      exchange: g?.Exchange || undefined,
    };
  }

  async getQuote(symbol: string): Promise<Quote> {
    const data = await this.request<EodhdQuote>(`/real-time/${encodeURIComponent(symbol)}`);
    return {
      symbol,
      price: String(data.close),
      change: String(data.change),
      changePercent: String(data.change_p),
      asOf: new Date(data.timestamp * 1000).toISOString(),
    };
  }

  async getFinancials(symbol: string): Promise<Financials> {
    const data = await this.fetchFundamentals(symbol);
    const h = data.Highlights;
    const num = (v: number | undefined) => (v === undefined || v === null ? null : String(v));
    return {
      symbol,
      fiscalYearEnd: data.General?.FiscalYearEnd || undefined,
      peRatio: num(h?.PERatio),
      eps: num(h?.EarningsShare),
      dividendPerShare: num(h?.DividendShare),
      dividendYield: num(h?.DividendYield),
      marketCap: num(h?.MarketCapitalization),
      revenueTtm: num(h?.RevenueTTM),
      profitMargin: num(h?.ProfitMargin),
      sharesOutstanding: num(data.SharesStats?.SharesOutstanding),
    };
  }

  async getCashFlow(symbol: string): Promise<CashFlowSummary> {
    const data = await this.fetchFundamentals(symbol);
    const annual = data.Financials?.Cash_Flow?.annual;
    const latest = Array.isArray(annual)
      ? annual[0]
      : annual
        ? Object.entries(annual).sort(([a], [b]) => b.localeCompare(a))[0]?.[1]
        : undefined;

    if (!latest) {
      return { symbol, freeCashFlow: null, fiscalDateEnding: null };
    }

    const operating =
      latest.totalCashFromOperatingActivities !== undefined ? Number(latest.totalCashFromOperatingActivities) : null;
    const capex = latest.capitalExpenditures !== undefined ? Number(latest.capitalExpenditures) : null;
    const freeCashFlow =
      operating !== null && capex !== null && !Number.isNaN(operating) && !Number.isNaN(capex)
        ? String(operating - capex)
        : null;

    return { symbol, freeCashFlow, fiscalDateEnding: latest.date ?? null };
  }

  async getDividendHistory(symbol: string): Promise<DividendEvent[]> {
    const data = await this.request<EodhdDividend[]>(`/div/${encodeURIComponent(symbol)}`);
    return data
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20)
      .map((d) => ({
        exDividendDate: d.date,
        paymentDate: d.paymentDate ?? null,
        amount: String(d.value),
      }));
  }

  async getPriceHistory(symbol: string): Promise<PricePoint[]> {
    const from = new Date();
    from.setDate(from.getDate() - 140); // ~100 trading days
    const data = await this.request<EodhdEodPoint[]>(`/eod/${encodeURIComponent(symbol)}`, {
      period: "d",
      from: from.toISOString().slice(0, 10),
    });
    return data.map((p) => ({ date: p.date, close: String(p.close) })).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getNextEarnings(symbol: string): Promise<EarningsInfo> {
    const data = await this.request<{ earnings?: EodhdEarningsEntry[] }>("/calendar/earnings", { symbols: symbol });
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = (data.earnings ?? [])
      .filter((e) => e.report_date >= today)
      .sort((a, b) => a.report_date.localeCompare(b.report_date));

    const next = upcoming[0];
    if (!next) return { symbol, nextReportDate: null, estimate: null };
    return {
      symbol,
      nextReportDate: next.report_date,
      estimate: next.estimate !== undefined ? String(next.estimate) : null,
    };
  }

  async getNews(symbol: string): Promise<NewsItem[]> {
    const data = await this.request<EodhdNewsItem[]>("/news", { s: symbol, limit: "20" });
    return data.map((item) => ({
      title: item.title,
      url: item.link,
      source: hostnameOf(item.link) ?? "EODHD",
      publishedAt: new Date(item.date).toISOString(),
      summary: item.content,
    }));
  }
}

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
