import { z } from "zod";

/** Treats an unset-but-present env var (PORT= in a .env file) the same as a genuinely absent one. */
const optionalNonEmpty = () =>
  z
    .string()
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  OPENAI_API_KEY: optionalNonEmpty(),
  ALPHA_VANTAGE_API_KEY: optionalNonEmpty(),
  EODHD_API_KEY: optionalNonEmpty(),

  // Which MarketDataProvider apps/api wires up. alpha-vantage has better US coverage
  // for free; eodhd is paid but reaches mainland China (Shanghai/Shenzhen) and other
  // exchanges alpha-vantage doesn't cover.
  MARKET_DATA_PROVIDER: z.enum(["alpha-vantage", "eodhd"]).default("alpha-vantage"),

  // Hard daily spend ceiling enforced by the AI orchestrator, in USD.
  AI_DAILY_BUDGET_USD: z.coerce.number().default(2),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}
