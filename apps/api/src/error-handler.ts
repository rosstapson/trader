import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { MarketDataError } from "@trader/market-data";
import { AIBudgetExceededError, LLMProviderError } from "@trader/ai";
import { MissingApiKeyError } from "./providers.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "invalid_request", message: err.message });
    return;
  }
  if (err instanceof MissingApiKeyError) {
    res.status(503).json({ error: "provider_not_configured", message: err.message });
    return;
  }
  if (err instanceof AIBudgetExceededError) {
    res.status(429).json({ error: "ai_budget_exceeded", message: err.message });
    return;
  }
  if (err instanceof MarketDataError || err instanceof LLMProviderError) {
    res.status(502).json({ error: "upstream_provider_error", message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "internal_error", message: "Something went wrong." });
};
