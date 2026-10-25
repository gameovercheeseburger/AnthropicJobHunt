import type { Application, ApplicationRepository, ApplicationStatus } from "@ajh/core";
import { and, eq, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { applications } from "../schema";

const columns = {
  id: applications.id,
  userId: applications.userId,
  jobId: applications.jobId,
  status: applications.status,
  createdAt: applications.createdAt,
  updatedAt: applications.updatedAt,
};

export class DrizzleApplicationRepository implements ApplicationRepository {
  constructor(private readonly db: Executor) {}

  async findByUserAndJob(userId: string, jobId: string): Promise<Application | null> {
    const [row] = await this.db
      .select(columns)
      .from(applications)
      .where(and(eq(applications.userId, userId), eq(applications.jobId, jobId)))
      .limit(1);
    return row ?? null;
  }

  async upsertStatus(input: { userId: string; jobId: string; status: ApplicationStatus }): Promise<Application> {
    const [row] = await this.db
      .insert(applications)
      .values(input)
      .onConflictDoUpdate({
        target: [applications.userId, applications.jobId],
        set: { status: input.status, updatedAt: sql`now()` },
      })
      .returning(columns);
    return row!;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(applications).where(eq(applications.id, id));
  }
}
