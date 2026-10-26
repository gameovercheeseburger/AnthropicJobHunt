import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// ENV_FILE lets the same script target production, e.g. ENV_FILE=../../.env.production.local
config({ path: process.env.ENV_FILE ?? "../../.env" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
