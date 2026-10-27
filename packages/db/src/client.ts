import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export interface DatabaseOptions {
  /** Serverless hosts (Vercel) run many short-lived instances: keep each pool tiny. */
  serverless?: boolean;
}

/**
 * libpq-only URL options that postgres.js would otherwise forward to the server as startup
 * parameters, which Postgres rejects ("unrecognized configuration parameter"). Neon adds
 * `channel_binding=require` to its connection strings by default.
 */
const LIBPQ_ONLY_PARAMS = ["channel_binding", "gssencmode", "sslcompression"];

export function toDriverUrl(url: string): string {
  try {
    const parsed = new URL(url);
    LIBPQ_ONLY_PARAMS.forEach((p) => parsed.searchParams.delete(p));
    return parsed.toString();
  } catch {
    return url; // not a URL (e.g. unusual local DSN): pass through unchanged
  }
}

export function createDatabase(rawUrl: string, options: DatabaseOptions = {}) {
  const url = toDriverUrl(rawUrl);
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
