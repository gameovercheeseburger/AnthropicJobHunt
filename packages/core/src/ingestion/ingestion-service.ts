import type { IngestionCounts, IngestionReport, NormalizedJobInput, SourceDefinition } from "../domain/ingestion";
import type { IngestionRepository, SourceRepository } from "../ports/ingestion";
import type { ConnectorRegistry } from "./connector-registry";
import { jobFingerprint } from "./normalize";

/** Which jobs the platform keeps. Canada-focused for now; a strategy so markets can be added later. */
export type JobFilter = (job: NormalizedJobInput) => boolean;
export const canadaOnly: JobFilter = (job) => job.country === "CA";

/** Jobs from search-based sources expire after this long without being seen again. */
export const STALE_AFTER_DAYS = 14;

export interface IngestionServiceDeps {
  sources: SourceRepository;
  ingestion: IngestionRepository;
  connectors: ConnectorRegistry;
  filter?: JobFilter;
  now?: () => Date;
}

/** Service layer: fetch → filter → dedupe/store → expire stale listings, with a run record per source. */
export class IngestionService {
  private readonly filter: JobFilter;
  private readonly now: () => Date;

  constructor(private readonly deps: IngestionServiceDeps) {
    this.filter = deps.filter ?? canadaOnly;
    this.now = deps.now ?? (() => new Date());
  }

  async runAll(): Promise<IngestionReport[]> {
    const reports: IngestionReport[] = [];
    for (const source of await this.deps.sources.listEnabled()) reports.push(await this.runSource(source));
    await this.deps.ingestion.expireOverdue(this.now(), STALE_AFTER_DAYS);
    return reports;
  }

  async runByKey(key: string): Promise<IngestionReport> {
    const source = await this.deps.sources.findByKey(key);
    if (!source) throw new Error(`Unknown source "${key}"`);
    return this.runSource(source);
  }

  private async runSource(source: SourceDefinition): Promise<IngestionReport> {
    const counts: IngestionCounts = { fetched: 0, kept: 0, created: 0, updated: 0, expired: 0, failedScopes: 0 };
    const errors: string[] = [];
    const { runId, startedAt } = await this.deps.ingestion.startRun(source.id);

    try {
      const connector = this.deps.connectors.get(source.key);
      for await (const result of connector.fetch(source)) {
        if (!result.ok) {
          counts.failedScopes++;
          errors.push(`${result.scope}: ${result.error}`);
          continue; // keep that scope's existing jobs: a failed fetch is not proof they're gone
        }
        counts.fetched += result.jobs.length;
        for (const job of result.jobs) {
          if (!this.filter(job)) continue;
          counts.kept++;
          try {
            const outcome = await this.deps.ingestion.upsertJob(source.id, job, jobFingerprint(job));
            counts[outcome]++;
          } catch (err) {
            errors.push(`${job.externalId}: ${message(err)}`);
          }
        }
        if (result.complete !== false) {
          counts.expired += await this.deps.ingestion.expireUnseen(source.id, result.scope, startedAt);
        }
      }
    } catch (err) {
      errors.push(message(err));
    }

    await this.deps.ingestion.finishRun(runId, { counts, error: errors.length ? errors.slice(0, 20).join("\n") : null });
    return { sourceKey: source.key, ...counts, errors };
  }
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
