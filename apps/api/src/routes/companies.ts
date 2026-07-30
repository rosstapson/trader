import { Router } from "express";
import { z } from "zod";
import { db, companies } from "@trader/db";
import { ResearchAgent } from "@trader/ai";
import type { CompanyOverview } from "@trader/shared";
import { getMarketDataProvider, getOrchestrator } from "../providers.js";
import { getDefaultUserId } from "../user.js";

export const companiesRouter: Router = Router();

companiesRouter.get("/search", async (req, res, next) => {
  try {
    const q = z.string().min(1).parse(req.query.q);
    const results = await getMarketDataProvider().search(q);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

async function fetchOverview(symbol: string): Promise<CompanyOverview> {
  const provider = getMarketDataProvider();
  const [profile, quote, financials, news] = await Promise.all([
    provider.getProfile(symbol),
    provider.getQuote(symbol),
    provider.getFinancials(symbol),
    provider.getNews(symbol),
  ]);
  return { profile, quote, financials, news };
}

async function cacheCompanyProfile(overview: CompanyOverview): Promise<void> {
  const { profile } = overview;
  await db
    .insert(companies)
    .values({
      symbol: profile.symbol,
      name: profile.name,
      exchange: profile.exchange,
      sector: profile.sector,
      industry: profile.industry,
      description: profile.description,
    })
    .onConflictDoUpdate({
      target: companies.symbol,
      set: {
        name: profile.name,
        exchange: profile.exchange,
        sector: profile.sector,
        industry: profile.industry,
        description: profile.description,
        updatedAt: new Date(),
      },
    });
}

companiesRouter.get("/:symbol/overview", async (req, res, next) => {
  try {
    const symbol = z.string().min(1).parse(req.params.symbol).toUpperCase();
    const overview = await fetchOverview(symbol);
    await cacheCompanyProfile(overview);
    res.json(overview);
  } catch (err) {
    next(err);
  }
});

companiesRouter.get("/:symbol/summary", async (req, res, next) => {
  try {
    const symbol = z.string().min(1).parse(req.params.symbol).toUpperCase();
    const overview = await fetchOverview(symbol);
    await cacheCompanyProfile(overview);

    const userId = await getDefaultUserId();
    const agent = new ResearchAgent(getOrchestrator());
    const result = await agent.summarize(userId, overview);

    res.json({ ...result.output, cached: result.cached, costUsd: result.costUsd });
  } catch (err) {
    next(err);
  }
});
