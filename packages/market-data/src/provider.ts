import type {
  CompanySearchResult,
  Quote,
  Financials,
  NewsItem,
  CompanyProfile,
  DividendEvent,
  PricePoint,
  CashFlowSummary,
} from "@trader/shared";

/**
 * Every market data source (free tier today, premium feed later) implements this.
 * Call sites depend only on this interface, never on a specific vendor's SDK/response shape.
 */
export interface MarketDataProvider {
  readonly name: string;
  search(query: string): Promise<CompanySearchResult[]>;
  getProfile(symbol: string): Promise<CompanyProfile>;
  getQuote(symbol: string): Promise<Quote>;
  getFinancials(symbol: string): Promise<Financials>;
  getNews(symbol: string): Promise<NewsItem[]>;
  getDividendHistory(symbol: string): Promise<DividendEvent[]>;
  getPriceHistory(symbol: string): Promise<PricePoint[]>;
  getCashFlow(symbol: string): Promise<CashFlowSummary>;
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}
