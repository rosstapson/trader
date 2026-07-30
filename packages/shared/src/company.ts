import { z } from "zod";

export const companySearchResultSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  exchange: z.string().optional(),
  assetType: z.string().optional(),
});
export type CompanySearchResult = z.infer<typeof companySearchResultSchema>;

export const quoteSchema = z.object({
  symbol: z.string(),
  price: z.string(), // decimal-as-string over the wire; parse with decimal.js on use
  change: z.string(),
  changePercent: z.string(),
  asOf: z.string(), // ISO timestamp
});
export type Quote = z.infer<typeof quoteSchema>;

export const financialsSchema = z.object({
  symbol: z.string(),
  fiscalYearEnd: z.string().optional(),
  peRatio: z.string().nullable().optional(),
  eps: z.string().nullable().optional(),
  dividendPerShare: z.string().nullable().optional(),
  dividendYield: z.string().nullable().optional(),
  marketCap: z.string().nullable().optional(),
  revenueTtm: z.string().nullable().optional(),
  profitMargin: z.string().nullable().optional(),
});
export type Financials = z.infer<typeof financialsSchema>;

export const newsItemSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string(),
  publishedAt: z.string(),
  summary: z.string().optional(),
});
export type NewsItem = z.infer<typeof newsItemSchema>;

export const companyProfileSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  description: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  exchange: z.string().optional(),
});
export type CompanyProfile = z.infer<typeof companyProfileSchema>;

export const companyOverviewSchema = z.object({
  profile: companyProfileSchema,
  quote: quoteSchema,
  financials: financialsSchema,
  news: z.array(newsItemSchema),
});
export type CompanyOverview = z.infer<typeof companyOverviewSchema>;
