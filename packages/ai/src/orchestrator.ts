import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@trader/db";
import { aiOutputs } from "@trader/db";
import { DISCLAIMER_VERSION } from "@trader/shared";
import type { z } from "zod";
import type { LLMProvider } from "./provider.js";
import { LLMProviderError } from "./provider.js";

export class AIBudgetExceededError extends Error {
  constructor(
    public readonly userId: string,
    public readonly limitUsd: number,
  ) {
    super(`Daily AI budget of $${limitUsd} exceeded`);
    this.name = "AIBudgetExceededError";
  }
}

export interface AgentRunRequest<T> {
  userId: string;
  symbol: string;
  agentName: string;
  /** Derived from the underlying data version (e.g. latest close date), not wall-clock time. */
  inputHash: string;
  system: string;
  prompt: string;
  outputSchema: z.ZodType<T>;
}

export interface AgentRunResult<T> {
  output: T;
  cached: boolean;
  costUsd: number;
  disclaimerVersion: string;
  generatedAt: Date;
}

/**
 * Cache-checks and budget-gates every agent call before it reaches the LLM, and
 * writes every generated output to the append-only ai_outputs ledger unconditionally.
 * See ARCHITECTURE.md §1.3, §1.6, §6.
 */
export class AgentOrchestrator {
  constructor(
    private readonly db: Db,
    private readonly llm: LLMProvider,
    private readonly dailyBudgetUsd: number,
  ) {}

  async run<T>(req: AgentRunRequest<T>): Promise<AgentRunResult<T>> {
    const cached = await this.findCached(req);
    if (cached) {
      return {
        output: cached.output,
        cached: true,
        costUsd: 0,
        disclaimerVersion: cached.disclaimerVersion,
        generatedAt: cached.generatedAt,
      };
    }

    await this.assertBudget(req.userId);

    const result = await this.llm.complete({ system: req.system, prompt: req.prompt });
    const output = this.parseOutput(req, result.text);
    const generatedAt = new Date();

    await this.db.insert(aiOutputs).values({
      userId: req.userId,
      symbol: req.symbol,
      agentName: req.agentName,
      inputHash: req.inputHash,
      output: output as object,
      model: result.model,
      costUsd: result.costUsd.toFixed(6),
      disclaimerVersion: DISCLAIMER_VERSION,
      createdAt: generatedAt,
    });

    return { output, cached: false, costUsd: result.costUsd, disclaimerVersion: DISCLAIMER_VERSION, generatedAt };
  }

  private async findCached<T>(
    req: AgentRunRequest<T>,
  ): Promise<{ output: T; disclaimerVersion: string; generatedAt: Date } | undefined> {
    const [row] = await this.db
      .select()
      .from(aiOutputs)
      .where(
        and(
          eq(aiOutputs.userId, req.userId),
          eq(aiOutputs.agentName, req.agentName),
          eq(aiOutputs.symbol, req.symbol),
          eq(aiOutputs.inputHash, req.inputHash),
        ),
      )
      .orderBy(desc(aiOutputs.createdAt))
      .limit(1);

    if (!row) return undefined;

    const parsed = req.outputSchema.safeParse(row.output);
    // If the schema changed since this row was written, treat it as a miss rather than
    // returning data that no longer matches what callers expect.
    if (!parsed.success) return undefined;

    return { output: parsed.data, disclaimerVersion: row.disclaimerVersion, generatedAt: row.createdAt };
  }

  private async assertBudget(userId: string): Promise<void> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [row] = await this.db
      .select({ total: sql<string>`coalesce(sum(${aiOutputs.costUsd}), 0)` })
      .from(aiOutputs)
      .where(and(eq(aiOutputs.userId, userId), gte(aiOutputs.createdAt, startOfDay)));

    const spentToday = Number(row?.total ?? 0);
    if (spentToday >= this.dailyBudgetUsd) {
      throw new AIBudgetExceededError(userId, this.dailyBudgetUsd);
    }
  }

  private parseOutput<T>(req: AgentRunRequest<T>, text: string): T {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new LLMProviderError(`${req.agentName} returned non-JSON output`, this.llm.name, err);
    }
    const parsed = req.outputSchema.safeParse(json);
    if (!parsed.success) {
      throw new LLMProviderError(
        `${req.agentName} output failed schema validation: ${parsed.error.message}`,
        this.llm.name,
      );
    }
    return parsed.data;
  }
}
