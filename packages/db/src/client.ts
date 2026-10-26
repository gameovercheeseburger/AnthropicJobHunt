import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export interface DatabaseOptions {
  /** Serverless hosts (Vercel) run many short-lived instances: keep each pool tiny. */
  serverless?: boolean;
}

export function createDatabase(url: string, options: DatabaseOptions = {}) {
  const client = postgres(url, {
    max: options.serverless ? 3 : 10,
    // Pooled endpoints (e.g. Neon "-pooler" hosts, PgBouncer) don't support prepared statements.
    prepare: !/-pooler\.|pgbouncer=true/.test(url),
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDatabase>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything repositories can run queries against: the pool or an open transaction. */
export type Executor = Database | Transaction;
