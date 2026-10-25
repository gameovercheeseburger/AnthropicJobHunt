import { SWIPE_OUTCOME, type Application, type Swipe, type SwipeDirection } from "../domain/swipe";
import { NotFoundError } from "../errors";
import type { UnitOfWork } from "../ports/repositories";

export interface SwipeResult {
  swipe: Swipe;
  application: Application | null;
}

/** Statuses a swipe may create, and therefore the only ones an undo may remove. */
const SWIPE_CREATED_STATUSES = new Set(Object.values(SWIPE_OUTCOME).filter(Boolean));

/**
 * Service layer: the swipe use cases.
 * right → application queued for tailoring, up → saved, left → pass.
 */
export class SwipeService {
  constructor(private readonly uow: UnitOfWork) {}

  swipe(userId: string, jobId: string, direction: SwipeDirection): Promise<SwipeResult> {
    return this.uow.run(async ({ jobs, swipes, applications }) => {
      if (!(await jobs.exists(jobId))) throw new NotFoundError("job", jobId);

      const swipe = await swipes.upsert({ userId, jobId, direction });
      const status = SWIPE_OUTCOME[direction];
      const existing = await applications.findByUserAndJob(userId, jobId);

      // Never downgrade an application the user has already moved forward (e.g. "applied").
      if (existing && !SWIPE_CREATED_STATUSES.has(existing.status)) {
        return { swipe, application: existing };
      }
      if (status === null) {
        if (existing) await applications.delete(existing.id);
        return { swipe, application: null };
      }
      const application = await applications.upsertStatus({ userId, jobId, status });
      return { swipe, application };
    });
  }

  /** Rewind the most recent swipe. Returns the job id that should reappear, if any. */
  undoLast(userId: string): Promise<string | null> {
    return this.uow.run(async ({ swipes, applications }) => {
      const last = await swipes.findLatest(userId);
      if (!last) return null;

      const app = await applications.findByUserAndJob(userId, last.jobId);
      if (app && SWIPE_CREATED_STATUSES.has(app.status)) await applications.delete(app.id);
      await swipes.delete(userId, last.jobId);
      return last.jobId;
    });
  }
}
