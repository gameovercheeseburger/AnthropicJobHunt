/**
 * Database URLs under whichever names the host provides. The Neon ↔ Vercel integration sets
 * DATABASE_URL / DATABASE_URL_UNPOOLED, while Vercel's Postgres-style naming uses
 * POSTGRES_URL / POSTGRES_URL_NON_POOLING. Pooled is for the app; direct is for migrations.
 */
export function resolveDatabaseUrls(env: Record<string, string | undefined> = process.env) {
  const pick = (...names: string[]) => names.map((n) => env[n]?.trim()).find((v) => v) ?? null;
  const pooled = pick("DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL");
  const direct = pick("DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING");
  return { pooled: pooled ?? direct, direct: direct ?? pooled };
}
