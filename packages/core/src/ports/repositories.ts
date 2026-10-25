// Ports (Repository pattern): the persistence contracts the services depend on.
// Adapters live in @ajh/db; tests use in-memory fakes.

import type { JobCard } from "../domain/job";
import type { Application, ApplicationStatus, Swipe, SwipeDirection } from "../domain/swipe";
import type { ProfileRepository, ResumeRepository } from "./resume";

export interface FeedQuery {
  userId: string;
  limit: number;
}

export interface JobRepository {
  /** Active jobs the user has not swiped yet, newest first. */
  findUnswipedForUser(query: FeedQuery): Promise<JobCard[]>;
  exists(jobId: string): Promise<boolean>;
}

export interface SwipeRepository {
  /** Insert or replace the user's decision on a job. */
  upsert(swipe: { userId: string; jobId: string; direction: SwipeDirection }): Promise<Swipe>;
  findLatest(userId: string): Promise<Swipe | null>;
  delete(userId: string, jobId: string): Promise<void>;
}

export interface ApplicationRepository {
  findByUserAndJob(userId: string, jobId: string): Promise<Application | null>;
  /** Create the application, or move an existing one to `status`. */
  upsertStatus(input: { userId: string; jobId: string; status: ApplicationStatus }): Promise<Application>;
  delete(id: string): Promise<void>;
}

export interface Repositories {
  jobs: JobRepository;
  swipes: SwipeRepository;
  applications: ApplicationRepository;
  resumes: ResumeRepository;
  profiles: ProfileRepository;
}

/** Unit of Work: runs a use case atomically against transaction-bound repositories. */
export interface UnitOfWork {
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}
