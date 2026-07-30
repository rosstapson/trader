export interface CompletionRequest {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/**
 * Every LLM backend (OpenAI today; Claude/Gemini/local later) implements this.
 * Agents depend only on this interface — see ARCHITECTURE.md §3.
 */
export interface LLMProvider {
  readonly name: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}
