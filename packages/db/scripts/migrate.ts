import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "../src/client";
import { resolveDatabaseUrls } from "../src/env";

// ENV_FILE lets the same script target production, e.g. ENV_FILE=../../.env.production.local
config({ path: process.env.ENV_FILE ?? "../../.env" });

// Migrations need a direct (unpooled) connection; the app itself uses the pooled DATABASE_URL.
const db = createDatabase(resolveDatabaseUrls().direct!);

// Extensions must exist before the generated migrations reference vector / trigram types.
await db.execute(sql`create extension if not exists vector`);
await db.execute(sql`create extension if not exists pg_trgm`);
await migrate(db, { migrationsFolder: "./migrations" });

console.log("Migrations applied.");
await db.$client.end();
