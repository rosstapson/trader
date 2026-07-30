import type { CompanyOverview, ResearchSummary, FairValueEstimate, CashFlowSummary } from "@trader/shared";
import { researchSummarySchema } from "@trader/shared";
import type { AgentOrchestrator, AgentRunResult } from "../orchestrator.js";
import { hashInput } from "../hash.js";

const AGENT_NAME = "research-agent";

// What we actually ask the LLM to produce. fairValueEstimates are computed deterministically
// (see @trader/shared valuation.ts) — the LLM has no basis to invent numbers, only to
// comment on ones it's given. symbol/disclaimerVersion/generatedAt are filled in from
// data the orchestrator already knows.
const llmOutputSchema = researchSummarySchema.omit({
  symbol: true,
  disclaimerVersion: true,
  generatedAt: true,
  fairValueEstimates: true,
});

function buildPrompt(overview: CompanyOverview, valuations: FairValueEstimate[]): string {
  const { profile, quote, financials, news } = overview;
  const newsLines = news
    .slice(0, 5)
    .map((n) => `- (${n.publishedAt}) ${n.title}`)
    .join("\n");

  const valuationLines = valuations.length
    ? valuations.map((v) => `- ${v.method}: ${v.estimate} (${v.confidence} confidence — ${v.notes})`).join("\n")
    : "- none computable from available data";

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

Already-computed fair value estimates (formulas, not your opinion — do not recompute or contradict the numbers, just factor them into your reasoning):
${valuationLines}

Produce a beginner-friendly research summary as JSON matching this shape:
{
  "summary": string (2-3 plain-English sentences),
  "bullCase": string[] (2-4 points),
  "bearCase": string[] (2-4 points),
  "risks": string[] (2-4 points),
  "overallConfidence": "low"|"medium"|"high"
}
Be honest about uncertainty — this is for a beginner investor, not a trading signal.`;
}

const SYSTEM_PROMPT =
  "You are a careful equity research assistant for beginner investors. " +
  "You explain financial concepts in plain English, avoid hype, and are explicit about uncertainty. " +
  "You are given pre-computed fair-value estimates from fixed formulas — treat them as facts to " +
  "reference, never invent or restate different numbers yourself. " +
  "You are not a financial advisor and never tell the user what to do. " +
  "Always respond with a single JSON object and nothing else.";

export class ResearchAgent {
  constructor(private readonly orchestrator: AgentOrchestrator) {}

  async summarize(
    userId: string,
    overview: CompanyOverview,
    valuations: FairValueEstimate[],
    cashFlow?: CashFlowSummary,
  ): Promise<AgentRunResult<ResearchSummary>> {
    const inputHash = hashInput({
      quoteAsOf: overview.quote.asOf,
      fiscalYearEnd: overview.financials.fiscalYearEnd,
      latestNews: overview.news[0]?.publishedAt,
      cashFlowFiscalDateEnding: cashFlow?.fiscalDateEnding,
    });

    const result = await this.orchestrator.run({
      userId,
      symbol: overview.profile.symbol,
      agentName: AGENT_NAME,
      inputHash,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(overview, valuations),
      outputSchema: llmOutputSchema,
    });

    const full: ResearchSummary = {
      ...result.output,
      fairValueEstimates: valuations,
      symbol: overview.profile.symbol,
      disclaimerVersion: result.disclaimerVersion,
      generatedAt: result.generatedAt.toISOString(),
    };

    return { ...result, output: full };
  }
}
