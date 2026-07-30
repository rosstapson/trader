# Trader — AI Investment Intelligence Platform

Phase 1 (Investment Research Assistant) scaffold. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design, phased roadmap, and rationale behind the key decisions.

## Project layout

```
apps/
  web/    React + Vite + TS + Tailwind — search a company, view overview, generate an AI research summary
  api/    Express + TS — REST API, wraps the market-data and ai packages
packages/
  shared/       Zod schemas / types shared by web and api
  config/       env loading and validation
  db/           Drizzle schema, migrations, db client
  market-data/  MarketDataProvider interface + Alpha Vantage adapter + Postgres-backed cache
  ai/           LLMProvider interface + OpenAI adapter + budget-gated agent orchestrator + ResearchAgent
```

## Prerequisites

- Node 20+, pnpm (`corepack enable` or `npm i -g pnpm`)
- A Postgres instance. `docker/docker-compose.yml` provisions one for local dev if you have Docker/Podman; if not, point `DATABASE_URL` at any local or native Postgres install.

## Setup

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL if not using docker/docker-compose.yml as-is
```

Get API keys (both free tier, both optional to *start* the app — endpoints that need them return a clear `503 provider_not_configured` until set):

- OpenAI: https://platform.openai.com/api-keys → `OPENAI_API_KEY`
- Alpha Vantage: https://www.alphavantage.co/support/#api-key → `ALPHA_VANTAGE_API_KEY`

Apply the database schema:

```bash
pnpm db:generate   # only needed after changing packages/db/src/schema.ts
pnpm db:migrate
```

Run it:

```bash
pnpm dev:api   # http://localhost:4000
pnpm dev:web   # http://localhost:5173 (proxies /api to the api server)
```

Open http://localhost:5173, search a company (e.g. `AAPL`), open it, and click "Generate" for the AI research summary.

## Other commands

```bash
pnpm typecheck   # across all packages
pnpm build       # across all packages
pnpm lint        # web only currently (oxlint)
```

## Notes on this scaffold

- **No real auth yet.** `apps/api/src/user.ts` uses a single placeholder local user. Every table is already `user_id`-scoped (see ARCHITECTURE.md §1.4), so real signup/login is a self-contained addition later, not a schema migration.
- **Cost control is live, not aspirational.** `AI_DAILY_BUDGET_USD` (default $2) is enforced in `packages/ai/src/orchestrator.ts` before any OpenAI call, and every agent response is cached in Postgres keyed off the underlying data version — asking for the same company summary twice in a day costs nothing the second time.
- **Every AI output is logged.** `ai_outputs` is append-only; nothing is ever overwritten or deleted from it. This is what will let Phase 4 (paper trading) honestly evaluate whether the AI's calls were any good.
