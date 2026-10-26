import type { IngestionCounts, NormalizedJobInput, ScopeResult, SourceDefinition } from "../domain/ingestion";

/**
 * Strategy + Adapter: one connector per job source (Greenhouse, Lever, Ashby, Adzuna, ...).
 * It fetches, paginates, respects the source's limits, and returns normalized jobs per scope.
 */
export interface SourceConnector {
  readonly key: string;
  fetch(source: SourceDefinition): AsyncIterable<ScopeResult>;
}

export interface SourceRepository {
  listEnabled(): Promise<SourceDefinition[]>;
  findByKey(key: string): Promise<SourceDefinition | null>;
  /** Inserts sources that don't exist yet; never overwrites ones an admin has edited. */
  ensureDefaults(defaults: Array<Pick<SourceDefinition, "key" | "name" | "kind" | "config">>): Promise<void>;
}

export type UpsertOutcome = "created" | "updated";

export interface IngestionRepository {
  startRun(sourceId: string): Promise<{ runId: string; startedAt: Date }>;
  finishRun(runId: string, result: { counts: IngestionCounts; error: string | null }): Promise<void>;
  /** Stores one job: matches by (source, externalId), then by fingerprint (cross-source dedup), else creates. */
  upsertJob(sourceId: string, job: NormalizedJobInput, fingerprint: string): Promise<UpsertOutcome>;
  /**
   * Marks listings in `scope` not seen since `since` as gone; jobs with no remaining live listings expire.
   * Returns the number of jobs expired.
   */
  expireUnseen(sourceId: string, scope: string, since: Date): Promise<number>;
  /** Expires jobs past their deadline, and jobs no source has seen for `staleAfterDays`. */
  expireOverdue(now: Date, staleAfterDays: number): Promise<number>;
}
