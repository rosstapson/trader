import OpenAI from "openai";
import type { CompletionRequest, CompletionResult, LLMProvider } from "../provider.js";
import { LLMProviderError } from "../provider.js";

// USD per token. Update when OpenAI changes pricing; kept close to the call site
// deliberately since this is the one adapter-specific fact that goes stale.
const PRICING_PER_TOKEN = {
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
};

type SupportedModel = keyof typeof PRICING_PER_TOKEN;

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: SupportedModel = "gpt-4o-mini",
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    try {
      const res = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: req.maxOutputTokens ?? 1000,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
        response_format: { type: "json_object" },
      });

      const text = res.choices[0]?.message?.content ?? "";
      const inputTokens = res.usage?.prompt_tokens ?? 0;
      const outputTokens = res.usage?.completion_tokens ?? 0;
      const pricing = PRICING_PER_TOKEN[this.model];
      const costUsd = inputTokens * pricing.input + outputTokens * pricing.output;

      return { text, model: this.model, inputTokens, outputTokens, costUsd };
    } catch (err) {
      throw new LLMProviderError("OpenAI completion failed", this.name, err);
    }
  }
}
