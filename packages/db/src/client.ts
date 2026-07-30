import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadConfig } from "@trader/config";
import * as schema from "./schema.js";

const config = loadConfig();

const queryClient = postgres(config.DATABASE_URL);

export const db = drizzle(queryClient, { schema });
export type Db = typeof db;
