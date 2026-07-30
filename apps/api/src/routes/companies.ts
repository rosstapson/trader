import { Router } from "express";
import { z } from "zod";
import { ResearchAgent } from "@trader/ai";
import { computeValuations, type CompanyOverview } from "@trader/shared";
import { getMarketDataProvider, getOrchestrator } from "../providers.js";
import { getDefaultUserId } from "../user.js";
import { upsertCompanyProfile } from "../services/company-cache.js";

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

companiesRouter.get("/:symbol/overview", async (req, res, next) => {
  try {
    const symbol = z.string().min(1).parse(req.params.symbol).toUpperCase();
    const overview = await fetchOverview(symbol);
    await upsertCompanyProfile(overview.profile);
    res.json(overview);
  } catch (err) {
    next(err);
  }
});

companiesRouter.get("/:symbol/dividends", async (req, res, next) => {
  try {
    const symbol = z.string().min(1).parse(req.params.symbol).toUpperCase();
    const dividends = await getMarketDataProvider().getDividendHistory(symbol);
    res.json(dividends);
  } catch (err) {
    next(err);
  }
});

companiesRouter.get("/:symbol/prices", async (req, res, next) => {
  try {
    const symbol = z.string().min(1).parse(req.params.symbol).toUpperCase();
    const prices = await getMarketDataProvider().getPriceHistory(symbol);
    res.json(prices);
  } catch (err) {
    next(err);
  }
});

companiesRouter.get("/:symbol/summary", async (req, res, next) => {
  try {
    const symbol = z.string().min(1).parse(req.params.symbol).toUpperCase();
    const overview = await fetchOverview(symbol);
    await upsertCompanyProfile(overview.profile);

    const cashFlow = await getMarketDataProvider().getCashFlow(symbol);
    const valuations = computeValuations({
      eps: overview.financials.eps,
      dividendPerShare: overview.financials.dividendPerShare,
      sharesOutstanding: overview.financials.sharesOutstanding,
      freeCashFlow: cashFlow.freeCashFlow,
    });

    const userId = await getDefaultUserId();
    const agent = new ResearchAgent(getOrchestrator());
    const result = await agent.summarize(userId, overview, valuations, cashFlow);

    res.json({ ...result.output, cached: result.cached, costUsd: result.costUsd });
  } catch (err) {
    next(err);
  }
});
