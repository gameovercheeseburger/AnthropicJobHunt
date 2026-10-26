import type { SourceDefinition, SourceRepository } from "@ajh/core";
import { asc, eq } from "drizzle-orm";
import type { Executor } from "../client";
import { sources } from "../schema";

const toDefinition = (row: typeof sources.$inferSelect): SourceDefinition => ({
  id: row.id,
  key: row.key,
  name: row.name,
  kind: row.kind,
  config: row.config,
  enabled: row.enabled,
});

export class DrizzleSourceRepository implements SourceRepository {
  constructor(private readonly db: Executor) {}

  async listEnabled(): Promise<SourceDefinition[]> {
    const rows = await this.db.select().from(sources).where(eq(sources.enabled, true)).orderBy(asc(sources.key));
    return rows.map(toDefinition);
  }

  async findByKey(key: string): Promise<SourceDefinition | null> {
    const [row] = await this.db.select().from(sources).where(eq(sources.key, key)).limit(1);
    return row ? toDefinition(row) : null;
  }

  async ensureDefaults(defaults: Array<Pick<SourceDefinition, "key" | "name" | "kind" | "config">>): Promise<void> {
    if (defaults.length === 0) return;
    await this.db.insert(sources).values(defaults).onConflictDoNothing({ target: sources.key });
  }
}
