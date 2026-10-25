import { Salary, type FeedQuery, type JobCard, type JobRepository } from "@ajh/core";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { companies, jobListings, jobs, jobSwipes } from "../schema";

export class DrizzleJobRepository implements JobRepository {
  constructor(private readonly db: Executor) {}

  async findUnswipedForUser({ userId, limit }: FeedQuery): Promise<JobCard[]> {
    const applyUrl = sql<string>`(
      select ${jobListings.applyUrl} from ${jobListings}
      where ${jobListings.jobId} = ${jobs.id}
      order by ${jobListings.firstSeenAt} limit 1
    )`;
    const notSwiped = sql`not exists (
      select 1 from ${jobSwipes}
      where ${jobSwipes.userId} = ${userId} and ${jobSwipes.jobId} = ${jobs.id}
    )`;

    const rows = await this.db
      .select({
        job: jobs,
        companyName: companies.name,
        companyLogoUrl: companies.logoUrl,
        applyUrl,
      })
      .from(jobs)
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .where(and(eq(jobs.status, "active"), notSwiped))
      .orderBy(sql`${jobs.postedAt} desc nulls last`, desc(jobs.createdAt))
      .limit(limit);

    return rows.map(({ job, companyName, companyLogoUrl, applyUrl }) => ({
      id: job.id,
      title: job.title,
      companyName,
      companyLogoUrl,
      location: job.location,
      remoteType: job.remoteType,
      employmentType: job.employmentType,
      seniority: job.seniority,
      salary: Salary.create({
        min: job.salaryMin,
        max: job.salaryMax,
        currency: job.salaryCurrency,
        period: job.salaryPeriod,
      }),
      postedAt: job.postedAt,
      summary: job.summary,
      skills: job.skills,
      applyUrl,
    }));
  }

  async exists(jobId: string): Promise<boolean> {
    const [row] = await this.db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)).limit(1);
    return Boolean(row);
  }
}
