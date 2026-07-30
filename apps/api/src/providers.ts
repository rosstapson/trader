import { loadConfig } from "@trader/config";
import { db } from "@trader/db";
import {
  AlphaVantageProvider,
  EODHDProvider,
  CachedMarketDataProvider,
  type MarketDataProvider,
} from "@trader/market-data";
import { OpenAIProvider, AgentOrchestrator, type LLMProvider } from "@trader/ai";

const config = loadConfig();

let marketDataProvider: MarketDataProvider | undefined;
let orchestrator: AgentOrchestrator | undefined;

export class MissingApiKeyError extends Error {
  constructor(envVar: string) {
    super(`${envVar} is not set. Copy .env.example to .env and fill it in.`);
    this.name = "MissingApiKeyError";
  }
}

function buildMarketDataProvider(): MarketDataProvider {
  if (config.MARKET_DATA_PROVIDER === "eodhd") {
    if (!config.EODHD_API_KEY) throw new MissingApiKeyError("EODHD_API_KEY");
    return new EODHDProvider(config.EODHD_API_KEY);
  }
  if (!config.ALPHA_VANTAGE_API_KEY) throw new MissingApiKeyError("ALPHA_VANTAGE_API_KEY");
  return new AlphaVantageProvider(config.ALPHA_VANTAGE_API_KEY);
}

export function getMarketDataProvider(): MarketDataProvider {
  if (marketDataProvider) return marketDataProvider;
  marketDataProvider = new CachedMarketDataProvider(buildMarketDataProvider(), db);
  return marketDataProvider;
}

export function getOrchestrator(): AgentOrchestrator {
  if (orchestrator) return orchestrator;
  if (!config.OPENAI_API_KEY) throw new MissingApiKeyError("OPENAI_API_KEY");

  const llm: LLMProvider = new OpenAIProvider(config.OPENAI_API_KEY);
  orchestrator = new AgentOrchestrator(db, llm, config.AI_DAILY_BUDGET_USD);
  return orchestrator;
}
