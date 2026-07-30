import type { CompanyOverview, ResearchSummary } from "@trader/shared";
import { researchSummarySchema } from "@trader/shared";
import type { AgentOrchestrator, AgentRunResult } from "../orchestrator.js";
import { hashInput } from "../hash.js";

const AGENT_NAME = "research-agent";

// What we actually ask the LLM to produce. symbol/disclaimerVersion/generatedAt are
// filled in afterwards from data the orchestrator already knows, not asked of the model.
const llmOutputSchema = researchSummarySchema.omit({
  symbol: true,
  disclaimerVersion: true,
  generatedAt: true,
});

function buildPrompt(overview: CompanyOverview): string {
  const { profile, quote, financials, news } = overview;
  const newsLines = news
    .slice(0, 5)
    .map((n) => `- (${n.publishedAt}) ${n.title}`)
    .join("\n");

  return `Company: ${profile.name} (${profile.symbol})
Sector: ${profile.sector ?? "unknown"} / Industry: ${profile.industry ?? "unknown"}
Description: ${profile.description ?? "n/a"}

Current price: ${quote.price} (${quote.changePercent}% as of ${quote.asOf})

Fundamentals:
- P/E: ${financials.peRatio ?? "n/a"}
- EPS: ${financials.eps ?? "n/a"}
- Dividend/share: ${financials.dividendPerShare ?? "n/a"} (yield ${financials.dividendYield ?? "n/a"})
- Market cap: ${financials.marketCap ?? "n/a"}
- Revenue (TTM): ${financials.revenueTtm ?? "n/a"}
- Profit margin: ${financials.profitMargin ?? "n/a"}

Recent news:
${newsLines || "- none available"}

Produce a beginner-friendly research summary as JSON matching this shape:
{
  "summary": string (2-3 plain-English sentences),
  "bullCase": string[] (2-4 points),
  "bearCase": string[] (2-4 points),
  "risks": string[] (2-4 points),
  "fairValueEstimates": [{ "method": "dcf"|"comparables"|"dividend_discount", "estimate": string, "confidence": "low"|"medium"|"high", "notes": string }],
  "overallConfidence": "low"|"medium"|"high"
}
Only include valuation methods you have enough data to reason about; it's fine to return fewer than three.
Be honest about uncertainty — this is for a beginner investor, not a trading signal.`;
}

const SYSTEM_PROMPT =
  "You are a careful equity research assistant for beginner investors. " +
  "You explain financial concepts in plain English, avoid hype, and are explicit about uncertainty. " +
  "You are not a financial advisor and never tell the user what to do. " +
  "Always respond with a single JSON object and nothing else.";

export class ResearchAgent {
  constructor(private readonly orchestrator: AgentOrchestrator) {}

  async summarize(userId: string, overview: CompanyOverview): Promise<AgentRunResult<ResearchSummary>> {
    const inputHash = hashInput({
      quoteAsOf: overview.quote.asOf,
      fiscalYearEnd: overview.financials.fiscalYearEnd,
      latestNews: overview.news[0]?.publishedAt,
    });

    const result = await this.orchestrator.run({
      userId,
      symbol: overview.profile.symbol,
      agentName: AGENT_NAME,
      inputHash,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(overview),
      outputSchema: llmOutputSchema,
    });

    const full: ResearchSummary = {
      ...result.output,
      symbol: overview.profile.symbol,
      disclaimerVersion: result.disclaimerVersion,
      generatedAt: result.generatedAt.toISOString(),
    };

    return { ...result, output: full };
  }
}
