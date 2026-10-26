import {
  normalizeCompanyName,
  normalizeTitle,
  summarize,
  type IngestionCounts,
  type IngestionRepository,
  type NormalizedJobInput,
  type UpsertOutcome,
} from "@ajh/core";
import { and, eq, lt, sql } from "drizzle-orm";
import type { Database } from "../client";
import { companies, jobListings, jobs, sourceRuns, sources } from "../schema";

/** Postgres text columns reject NUL bytes, which occasionally appear in scraped descriptions. */
const clean = (s: string) => s.replace(/\u0000/g, "");

export class DrizzleIngestionRepository implements IngestionRepository {
  constructor(private readonly db: Database) {}

  async startRun(sourceId: string) {
    const [run] = await this.db
      .insert(sourceRuns)
      .values({ sourceId })
      .returning({ runId: sourceRuns.id, startedAt: sourceRuns.startedAt });
    return run!;
  }

  async finishRun(runId: string, { counts, error }: { counts: IngestionCounts; error: string | null }) {
    const [run] = await this.db
      .update(sourceRuns)
      .set({
        status: error && counts.kept === 0 ? "failed" : "succeeded",
        finishedAt: sql`now()`,
        fetched: counts.fetched,
        created: counts.created,
        updated: counts.updated,
        expired: counts.expired,
        error,
      })
      .where(eq(sourceRuns.id, runId))
      .returning({ sourceId: sourceRuns.sourceId });
    if (run) await this.db.update(sources).set({ lastRunAt: sql`now()` }).where(eq(sources.id, run.sourceId));
  }

  upsertJob(sourceId: string, job: NormalizedJobInput, fingerprint: string): Promise<UpsertOutcome> {
    return this.db.transaction(async (tx) => {
      const [company] = await tx
        .insert(companies)
        .values({ name: job.companyName, normalizedName: normalizeCompanyName(job.companyName) || job.companyName })
        .onConflictDoUpdate({ target: companies.normalizedName, set: { name: job.companyName } })
        .returning({ id: companies.id });

      const descriptionText = clean(job.descriptionText);
      const fields = {
        companyId: company!.id,
        title: clean(job.title),
        normalizedTitle: normalizeTitle(job.title),
        descriptionText,
        summary: summarize(descriptionText),
        skills: job.skills,
        location: job.location,
        country: job.country,
        remoteType: job.remoteType,
        employmentType: job.employmentType,
        seniority: job.seniority,
        salaryMin: job.salaryMin === null ? null : Math.round(job.salaryMin),
        salaryMax: job.salaryMax === null ? null : Math.round(job.salaryMax),
        salaryCurrency: job.salaryCurrency,
        salaryPeriod: job.salaryPeriod,
        postedAt: job.postedAt,
        status: "active" as const, // a job seen again comes back to life
        updatedAt: sql`now()`,
      };
      const listing = { applyUrl: job.applyUrl, lastSeenAt: sql`now()` };

      // 1. Same posting from the same source: refresh it.
      const [existing] = await tx
        .select({ jobId: jobListings.jobId })
        .from(jobListings)
        .where(and(eq(jobListings.sourceId, sourceId), eq(jobListings.externalId, job.externalId)))
        .limit(1);
      if (existing) {
        await tx.update(jobs).set(fields).where(eq(jobs.id, existing.jobId));
        await tx
          .update(jobListings)
          .set(listing)
          .where(and(eq(jobListings.sourceId, sourceId), eq(jobListings.externalId, job.externalId)));
        return "updated";
      }

      // 2. Same job already known from elsewhere (dedup): attach this listing to it.
      const [duplicate] = await tx
        .select({ id: jobs.id })
        .from(jobs)
        .where(eq(jobs.dedupFingerprint, fingerprint))
        .limit(1);
      const jobId =
        duplicate?.id ??
        // 3. New job.
        (await tx.insert(jobs).values({ ...fields, dedupFingerprint: fingerprint }).returning({ id: jobs.id }))[0]!.id;
      if (duplicate) await tx.update(jobs).set({ status: "active", updatedAt: sql`now()` }).where(eq(jobs.id, jobId));

      await tx.insert(jobListings).values({ jobId, sourceId, externalId: job.externalId, ...listing });
      return duplicate ? "updated" : "created";
    });
  }

  async expireUnseen(sourceId: string, scope: string, sinceDate: Date): Promise<number> {
    const since = sql`${sinceDate.toISOString()}::timestamptz`;
    const expired = await this.db.execute<{ id: string }>(sql`
      update ${jobs} set status = 'expired', updated_at = now()
      where ${jobs.status} = 'active'
        and ${jobs.id} in (
          select ${jobListings.jobId} from ${jobListings}
          where ${jobListings.sourceId} = ${sourceId}
            and starts_with(${jobListings.externalId}, ${`${scope}:`})
            and ${jobListings.lastSeenAt} < ${since}
        )
        and not exists (
          select 1 from ${jobListings} live
          where live.job_id = ${jobs.id} and live.last_seen_at >= ${since}
        )
      returning ${jobs.id}`);
    return expired.length;
  }

  async expireOverdue(now: Date, staleAfterDays: number): Promise<number> {
    const overdue = await this.db
      .update(jobs)
      .set({ status: "expired", updatedAt: sql`now()` })
      .where(and(eq(jobs.status, "active"), lt(jobs.expiresAt, now)))
      .returning({ id: jobs.id });

    const staleBefore = new Date(now.getTime() - staleAfterDays * 86_400_000).toISOString();
    const stale = await this.db.execute<{ id: string }>(sql`
      update ${jobs} set status = 'expired', updated_at = now()
      where ${jobs.status} = 'active'
        and not exists (
          select 1 from ${jobListings} l
          where l.job_id = ${jobs.id} and l.last_seen_at >= ${staleBefore}::timestamptz
        )
      returning ${jobs.id}`);
    return overdue.length + stale.length;
  }
}
