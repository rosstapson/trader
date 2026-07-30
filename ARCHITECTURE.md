# AI Investment Intelligence Platform — Architecture

Status: **Draft for review — no implementation yet.**
Scope decisions locked in for this draft: single-user now (SaaS-ready data model), deploy to a cloud VPS (Hetzner/Railway/Fly.io-style), no API keys acquired yet.

---

## 1. Architectural Principles

1. **Ports and adapters everywhere it matters.** Three things *will* change over this project's life: the AI provider, the market data provider, and the broker. Each gets a narrow TypeScript interface in `packages/*` with one adapter implementation today and room for more later. Nothing outside the adapter should import a vendor SDK directly.
2. **Money is never a JS `number`.** Postgres `NUMERIC` columns, `decimal.js` at every arithmetic boundary in TypeScript. This is decided now, in Phase 1, because retrofitting it after Phase 4's paper-trading ledger exists is much more painful than starting correctly.
3. **Every AI output is a logged, immutable fact.** Not just in Phase 4. From Phase 1, any AI-generated valuation, bull/bear case, or risk score is written to an append-only `ai_outputs` table with the inputs, model, cost, and timestamp. This is what lets Phase 4's "never hide poor performance" promise actually be honored — you can't retroactively construct a track record you didn't start recording.
4. **user_id on everything, auth kept simple.** Single-user now, but every table gets a `user_id` FK from day one and every query is scoped by it. That's the entire cost of staying SaaS-ready — it does not require building multi-tenant auth, roles, or orgs now.
5. **Boring infrastructure until proven necessary.** No Redis, no job queue, no Kubernetes, no vector DB service until a phase actually demands it. Postgres does double duty as cache store, job table, and (via `pgvector`) embedding store for a long time.
6. **Confidence and provenance are first-class from Phase 1**, not bolted on in Phase 9. Every AI-generated claim carries a confidence indicator and a "based on: X, Y, Z" trail from the very first summary the app produces. See §7 for why the source spec's Phase 9 placement is worth revisiting.

---

## 2. High-Level System Shape

```
apps/web  (React/Vite/TS)
    │  TanStack Query
    ▼
apps/api  (Express/TS)
    ├── routes/           REST endpoints, Zod-validated
    ├── agents/            orchestrator + individual agents (research, valuation, risk, news...)
    │     └── uses packages/ai        (LLMProvider interface: OpenAI adapter today)
    ├── services/          business logic (watchlists, portfolios, alerts)
    │     └── uses packages/market-data (MarketDataProvider interface: one free adapter today)
    └── jobs/              cron-style workers (price refresh, alert checks, news ingestion)
    ▼
Postgres (Drizzle ORM) — also acts as cache + job queue early on
```

Everything ships as containers via Docker Compose: `web`, `api`, `postgres`, `caddy` (TLS/reverse proxy). Same compose file runs locally and on the VPS — no environment-specific app code.

---

## 3. Provider Abstraction Pattern

Applied identically to AI, market data, and (later) brokers:

```ts
// packages/ai/src/provider.ts
interface LLMProvider {
  complete(req: CompletionRequest): Promise<CompletionResult>; // includes token usage/cost
}

// packages/market-data/src/provider.ts
interface MarketDataProvider {
  getQuote(symbol: string): Promise<Quote>;
  getFinancials(symbol: string): Promise<Financials>;
  getNews(symbol: string): Promise<NewsItem[]>;
  // ...
}
```

- Phase 1 ships exactly one implementation of each (OpenAI; one free market data provider — Alpha Vantage or Finnhub, chosen once we sign up).
- A thin `ProviderRegistry` picks the active adapter from config/env — swapping to Claude, Gemini, or a premium data feed later is a config change plus one new adapter file, not a rewrite.
- Market data adapters get a **fallback chain** from Phase 1 even with only one real provider wired up (the interface + a `CachedProvider` wrapper), because free-tier rate limits are a near-certainty, not a risk. Caching is the real mitigation; a second live provider can be added later without touching call sites.

---

## 4. AI Agent Architecture

Multiple narrow agents, not one mega-prompt, coordinated by a lightweight orchestrator:

- `ResearchAgent` — company overview, plain-English explanations
- `ValuationAgent` — DCF / comparables / dividend-discount fair-value estimates
- `RiskAgent` — risk factors, volatility context
- `NewsAgent` — summarizes recent news into "what changed and why it matters"
- `BullBearAgent` — structured pros/cons

Each agent:
- Has a Zod-validated input/output schema.
- Declares a `cacheKey(input)` derived from the *underlying data version* (e.g., latest filing date + latest close date), not wall-clock time — this is the core cost-control mechanism the spec asks for ("avoid repeatedly analysing unchanged data").
- Writes its output to `ai_outputs` before returning it, unconditionally.
- Runs against the `LLMProvider` interface, never a vendor SDK directly.

A per-user daily AI spend budget lives in the orchestrator, not as an aspiration — requests are cache-checked first, and the budget check happens before any LLM call is dispatched.

---

## 5. Project Structure

```
trader/
├── apps/
│   ├── web/                 React + Vite + TS + Tailwind + shadcn
│   └── api/                 Express + TS
├── packages/
│   ├── shared/               Zod schemas, shared types/constants (imported by web + api)
│   ├── db/                   Drizzle schema, migrations, db client
│   ├── ai/                   LLMProvider interface + OpenAI adapter, agents, orchestrator, cache
│   ├── market-data/          MarketDataProvider interface + adapter(s)
│   └── config/               env loading, shared tsconfig/eslint
├── docker/
│   ├── docker-compose.yml
│   └── Dockerfile.api / Dockerfile.web
├── docs/
│   ├── architecture/          ADRs (one file per significant decision)
│   └── phases/
├── package.json               pnpm workspaces root
└── pnpm-workspace.yaml
```

pnpm workspaces (not a heavier tool like Turborepo/Nx) — enough structure for this size project without extra build-system complexity to maintain.

---

## 6. Cost Optimisation (concrete, not aspirational)

- **Cache-first, always.** Every agent call checks `ai_outputs` for a matching `cacheKey` before calling the LLM.
- **Data-version-keyed cache**, not TTL-keyed — a company whose data hasn't changed in 3 weeks shouldn't be re-summarized every day just because a TTL expired.
- **Per-user daily budget** enforced in the orchestrator (hard cutoff, not just logging).
- **Batch where possible** — e.g., one news-summarization call per company per day covering all new articles, not one call per article.
- **Embeddings via `pgvector`** inside the existing Postgres instance for Phase 3 retrieval — no separate vector DB service until volume genuinely requires it.

---

## 7. Weaknesses in the Original Spec, and Recommendations

1. **Free market data reliability is understated.** Yahoo/Alpha Vantage/Finnhub free tiers have real rate limits and occasional breakage. Mitigation is architectural (fallback chain + aggressive caching), decided in Phase 1 even though only one adapter ships then.

2. **AI cost control needs a hard enforcement point, not just intent.** "Aggressively minimise AI costs" only holds if there's a budget gate in code. Built into the orchestrator from Phase 1 (§6).

3. **Regulatory/liability exposure is unaddressed.** Fair-value estimates, bull/bear cases, and risk scores read like investment advice. From Phase 1: every AI output surfaced in the UI carries a versioned "informational only, not financial advice" disclaimer, and outputs are tagged with a confidence score so users can calibrate trust. This isn't legal advice — flagging it as a product-design requirement to carry through every phase.

4. **Phase 4's "never hide poor performance" can't be honored unless logging starts on day one.** Addressed by making `ai_outputs` an append-only ledger from Phase 1, not something introduced in Phase 4 (§1.3).

5. **Phase 9 ("AI Reasoning" combining technical + fundamental + news + macro + sentiment with confidence scores) is placed too late.** As specified it reads like a phase, but architecturally it's a *dimension* that should thread through every phase from the start — Phase 1's `ValuationAgent` should already emit a confidence score, even if crude. Recommendation: treat "Phase 9" as an ongoing deepening of existing agents (add more signal inputs, calibrate confidence) rather than a discrete phase inserted after Phase 8. This changes the roadmap numbering slightly — see §8.

6. **Money-as-float bugs are a when-not-if risk** in a project with paper trading, portfolio accounting, and eventually real order execution. Decided now (§1.2): `NUMERIC` columns, `decimal.js` boundaries, enforced via a lint rule banning raw arithmetic on money-typed fields once Phase 4 lands.

7. **Secrets handling should be decided now, cheaply, rather than retrofitted before Phase 10.** `.env` (gitignored) locally; on the VPS, secrets injected via the hosting provider's secret store or Docker secrets — never committed, never baked into images. Trivial to do from day one, expensive to bolt on right before broker credentials enter the picture.

8. **Eleven phases is a multi-year roadmap.** Recommend an explicit checkpoint after Phase 2: pause and honestly assess whether the tool is actually useful in daily use before investing in Phase 3+. The spec's own principle ("every phase must produce a usable application") supports treating this as a real gate, not a formality.

---

## 8. Phased Roadmap, Complexity, and Deferrals

| Phase | Deliverable | Complexity | Notes |
|---|---|---|---|
| 1 | Research Assistant | **L** | Foundational — establishes DB schema, provider interfaces, agent pattern, frontend scaffold. Everything else builds on this. Not deferrable. |
| 2 | Watchlists | **S** | Mostly CRUD + first scheduled job (alert checks). Good checkpoint per §7.8. |
| 3 | Market Intelligence ingestion | **L** | Multiple sources, dedup, summarization pipeline. Reddit/social scraping has ToS and cost implications worth a separate check-in before building. |
| 4 | Paper Trading | **L** | Money-correct order engine and portfolio accounting; foundational for Phases 5–7 too. Get this right once. |
| 5 | Portfolio Advisor | **M** | Preference model (settings + prompt conditioning) and explainability UI on top of existing agents. |
| 6 | Strategy Engine | **M** | Pluggable strategy interface, same pattern as providers (§3). |
| 7 | Backtesting | **L** | Needs bulk historical OHLCV (may require a paid source), compute-heavy, own job runner. |
| 8 | Live Market Data | **S–M** | Mostly new adapters against the existing `MarketDataProvider` interface — this phase is where the Phase 1 abstraction investment pays off. |
| 9 | AI Reasoning depth | **M**, spread across phases | Recommend folding into 1, 3, 5, 6 incrementally rather than one discrete phase (§7.5). |
| 10 | Broker Integration | **L** | Compliance- and security-heavy; sandbox/paper mode first, adapter pattern from §3. |
| 11 | Automation | **XL** | Highest risk. Gate behind extensive Phase 4 paper-trading evidence, kill switch, hard daily-loss limits. |

**Defer until a phase genuinely demands them:**
- Redis (Postgres covers caching/simple queues through at least Phase 3)
- A real job queue like BullMQ (cron + a DB job table is enough early)
- Keycloak (local auth first, behind an `AuthProvider` interface for a clean swap)
- TimescaleDB (plain Postgres is fine until backtesting volume says otherwise)
- A standalone vector DB (`pgvector` in the existing Postgres instance)
- Kubernetes (Docker Compose on a single VPS is enough at this scale, likely permanently)
- Multi-tenant auth/orgs (keep `user_id` scoping only, per §1.4)

---

## 9. Open Decisions Log

| Decision | Status |
|---|---|
| Single-user now, `user_id`-scoped schema for later multi-tenancy | **Decided** |
| Deploy to cloud VPS via Docker Compose | **Decided** |
| No API keys yet — acquire OpenAI + one free market data provider before Phase 1 coding starts | **Decided** |
| Which free market data provider (Alpha Vantage vs Finnhub vs Yahoo-unofficial) | **Open — pick during Phase 1 setup, behind the interface either way** |
| Package manager: pnpm workspaces | **Proposed, not yet confirmed** |
| VPS provider (Hetzner vs Railway vs Fly.io) | **Open — affects only the Compose deployment target, not app code** |

---

## 10. Immediate Next Steps (once this design is approved)

1. `git init`, scaffold pnpm workspace with `apps/web`, `apps/api`, `packages/shared|db|ai|market-data|config`.
2. Drizzle schema for: `users`, `companies`, `ai_outputs`, `watchlists` (Phase 2 gets its own tables but the shape informs Phase 1's schema).
3. `MarketDataProvider` interface + one real adapter + `CachedProvider` wrapper.
4. `LLMProvider` interface + OpenAI adapter + budget-gated orchestrator.
5. First vertical slice: search a company → overview + financials + one AI summary, end to end, deployable.
