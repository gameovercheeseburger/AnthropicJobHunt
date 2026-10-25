import type { JobCard } from "../domain/job";
import type { JobRepository } from "../ports/repositories";

const MAX_PAGE = 50;

/**
 * Service layer: builds the swipe deck.
 * Ranking is recency for now; the embedding-based "matches my profile" ranking plugs in here later.
 */
export class FeedService {
  constructor(private readonly jobs: JobRepository) {}

  getDeck(userId: string, limit = 20): Promise<JobCard[]> {
    return this.jobs.findUnswipedForUser({ userId, limit: Math.min(Math.max(limit, 1), MAX_PAGE) });
  }
}
