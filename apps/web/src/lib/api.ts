import type {
  CompanySearchResult,
  CompanyOverview,
  ResearchSummary,
  DividendEvent,
  PricePoint,
  Watchlist,
  WatchlistDetail,
  WatchlistItemQuote,
  Alert,
  CreateAlertRequest,
} from "@trader/shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const responseBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(responseBody.message ?? res.statusText, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
const patch = <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {});
const del = <T>(path: string) => request<T>("DELETE", path);

export function searchCompanies(query: string): Promise<CompanySearchResult[]> {
  return get(`/api/companies/search?q=${encodeURIComponent(query)}`);
}

export function getCompanyOverview(symbol: string): Promise<CompanyOverview> {
  return get(`/api/companies/${encodeURIComponent(symbol)}/overview`);
}

export type ResearchSummaryResponse = ResearchSummary & { cached: boolean; costUsd: number };

export function getCompanySummary(symbol: string): Promise<ResearchSummaryResponse> {
  return get(`/api/companies/${encodeURIComponent(symbol)}/summary`);
}

export function getDividendHistory(symbol: string): Promise<DividendEvent[]> {
  return get(`/api/companies/${encodeURIComponent(symbol)}/dividends`);
}

export function getPriceHistory(symbol: string): Promise<PricePoint[]> {
  return get(`/api/companies/${encodeURIComponent(symbol)}/prices`);
}

export function listWatchlists(): Promise<Watchlist[]> {
  return get("/api/watchlists");
}

export function createWatchlist(name: string): Promise<Watchlist> {
  return post("/api/watchlists", { name });
}

export function renameWatchlist(id: string, name: string): Promise<Watchlist> {
  return patch(`/api/watchlists/${id}`, { name });
}

export function deleteWatchlist(id: string): Promise<void> {
  return del(`/api/watchlists/${id}`);
}

export function getWatchlist(id: string): Promise<WatchlistDetail> {
  return get(`/api/watchlists/${id}`);
}

export function addWatchlistItem(watchlistId: string, symbol: string): Promise<WatchlistItemQuote> {
  return post(`/api/watchlists/${watchlistId}/items`, { symbol });
}

export function updateWatchlistItemShares(
  watchlistId: string,
  itemId: string,
  shares: number | null,
): Promise<WatchlistItemQuote> {
  return patch(`/api/watchlists/${watchlistId}/items/${itemId}`, { shares });
}

export function removeWatchlistItem(watchlistId: string, itemId: string): Promise<void> {
  return del(`/api/watchlists/${watchlistId}/items/${itemId}`);
}

export function listAlerts(): Promise<Alert[]> {
  return get("/api/alerts");
}

export function createAlert(request: CreateAlertRequest): Promise<Alert> {
  return post("/api/alerts", request);
}

export function dismissAlert(id: string): Promise<Alert> {
  return patch(`/api/alerts/${id}/dismiss`);
}

export function deleteAlert(id: string): Promise<void> {
  return del(`/api/alerts/${id}`);
}
