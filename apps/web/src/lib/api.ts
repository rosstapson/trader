import type { CompanySearchResult, CompanyOverview, ResearchSummary } from "@trader/shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(body.message ?? res.statusText, res.status);
  }
  return res.json() as Promise<T>;
}

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
