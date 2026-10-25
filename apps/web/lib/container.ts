import "server-only";
import { FeedService, SwipeService } from "@ajh/core";
import { createDatabase, createRepositories, DrizzleUnitOfWork, type Database } from "@ajh/db";

/**
 * Composition root: the only place concrete adapters are wired to services.
 * Everything else depends on the service classes, never on Drizzle directly.
 */
function build() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repo root.");

  const db: Database = createDatabase(url);
  const repos = createRepositories(db);
  const uow = new DrizzleUnitOfWork(db);

  return {
    feed: new FeedService(repos.jobs),
    swipes: new SwipeService(uow),
  };
}

export type Container = ReturnType<typeof build>;

// Reuse one pool across hot reloads in development.
const globalForContainer = globalThis as unknown as { __ajhContainer?: Container };

export function container(): Container {
  return (globalForContainer.__ajhContainer ??= build());
}
