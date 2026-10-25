import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "../src/client";

config({ path: "../../.env" });

const db = createDatabase(process.env.DATABASE_URL!);

// Extensions must exist before the generated migrations reference vector / trigram types.
await db.execute(sql`create extension if not exists vector`);
await db.execute(sql`create extension if not exists pg_trgm`);
await migrate(db, { migrationsFolder: "./migrations" });

console.log("Migrations applied.");
await db.$client.end();
