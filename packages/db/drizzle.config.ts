import { defineConfig } from "drizzle-kit";
import { loadConfig } from "@trader/config";

const config = loadConfig();

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: config.DATABASE_URL,
  },
  strict: true,
});
