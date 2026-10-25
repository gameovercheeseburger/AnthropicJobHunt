import type { Swipe, SwipeDirection, SwipeRepository } from "@ajh/core";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { jobSwipes } from "../schema";

export class DrizzleSwipeRepository implements SwipeRepository {
  constructor(private readonly db: Executor) {}

  async upsert(input: { userId: string; jobId: string; direction: SwipeDirection }): Promise<Swipe> {
    const [row] = await this.db
      .insert(jobSwipes)
      .values(input)
      .onConflictDoUpdate({
        target: [jobSwipes.userId, jobSwipes.jobId],
        set: { direction: input.direction, createdAt: sql`now()` },
      })
      .returning();
    return row!;
  }

  async findLatest(userId: string): Promise<Swipe | null> {
    const [row] = await this.db
      .select()
      .from(jobSwipes)
      .where(eq(jobSwipes.userId, userId))
      .orderBy(desc(jobSwipes.createdAt))
      .limit(1);
    return row ?? null;
  }

  async delete(userId: string, jobId: string): Promise<void> {
    await this.db.delete(jobSwipes).where(and(eq(jobSwipes.userId, userId), eq(jobSwipes.jobId, jobId)));
  }
}
