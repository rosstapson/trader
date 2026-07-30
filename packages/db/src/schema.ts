import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  jsonb,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Cached reference data about a company, refreshed from the active MarketDataProvider.
 * Not user-scoped — this is shared market data, not user-owned state.
 */
export const companies = pgTable("companies", {
  symbol: varchar("symbol", { length: 20 }).primaryKey(),
  name: text("name").notNull(),
  exchange: text("exchange"),
  sector: text("sector"),
  industry: text("industry"),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const watchlists = pgTable(
  "watchlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("watchlists_user_id_idx").on(table.userId)],
);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 20 })
      .notNull()
      .references(() => companies.symbol),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("watchlist_items_unique_idx").on(table.watchlistId, table.symbol)],
);

/**
 * Append-only ledger of every AI-generated output. Written unconditionally at
 * generation time so later phases (paper trading performance review) can honor
 * "never hide poor performance" — the record exists whether or not the call
 * turns out to have been right. Rows are never updated or deleted.
 *
 * inputHash keys the cache: it is derived from the underlying data version
 * (e.g. latest close date, latest filing date), not wall-clock time, so
 * unchanged data doesn't trigger a new (billable) generation.
 */
export const aiOutputs = pgTable(
  "ai_outputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    agentName: text("agent_name").notNull(),
    inputHash: text("input_hash").notNull(),
    output: jsonb("output").notNull(),
    model: text("model").notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull(),
    disclaimerVersion: text("disclaimer_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_outputs_symbol_idx").on(table.symbol),
    index("ai_outputs_cache_lookup_idx").on(table.agentName, table.symbol, table.inputHash),
  ],
);

/**
 * Generic cache for MarketDataProvider responses, keyed by provider+method+params hash.
 * Fronts the free-tier data providers so their rate limits aren't hit on every request.
 */
export const marketDataCache = pgTable(
  "market_data_cache",
  {
    cacheKey: text("cache_key").primaryKey(),
    provider: text("provider").notNull(),
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("market_data_cache_expires_at_idx").on(table.expiresAt)],
);
