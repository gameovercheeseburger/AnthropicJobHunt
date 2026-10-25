// In-memory adapters for the repository ports. Used to test services without a database.
import type {
  Application,
  ApplicationRepository,
  JobCard,
  JobRepository,
  Repositories,
  Swipe,
  SwipeRepository,
  UnitOfWork,
} from "../src";

export class InMemoryStore {
  jobs = new Map<string, JobCard>();
  swipes: Swipe[] = [];
  applications: Application[] = [];
  private clock = 0;
  private seq = 0;

  now(): Date {
    return new Date(Date.UTC(2026, 0, 1) + ++this.clock * 1000);
  }
  nextId(): string {
    return `app-${++this.seq}`;
  }
}

class FakeJobRepository implements JobRepository {
  constructor(private readonly s: InMemoryStore) {}
  async findUnswipedForUser({ userId, limit }: { userId: string; limit: number }) {
    const swiped = new Set(this.s.swipes.filter((w) => w.userId === userId).map((w) => w.jobId));
    return [...this.s.jobs.values()].filter((j) => !swiped.has(j.id)).slice(0, limit);
  }
  async exists(jobId: string) {
    return this.s.jobs.has(jobId);
  }
}

class FakeSwipeRepository implements SwipeRepository {
  constructor(private readonly s: InMemoryStore) {}
  async upsert(input: Omit<Swipe, "createdAt">) {
    await this.delete(input.userId, input.jobId);
    const swipe = { ...input, createdAt: this.s.now() };
    this.s.swipes.push(swipe);
    return swipe;
  }
  async findLatest(userId: string) {
    return this.s.swipes.filter((w) => w.userId === userId).at(-1) ?? null;
  }
  async delete(userId: string, jobId: string) {
    this.s.swipes = this.s.swipes.filter((w) => !(w.userId === userId && w.jobId === jobId));
  }
}

class FakeApplicationRepository implements ApplicationRepository {
  constructor(private readonly s: InMemoryStore) {}
  async findByUserAndJob(userId: string, jobId: string) {
    return this.s.applications.find((a) => a.userId === userId && a.jobId === jobId) ?? null;
  }
  async upsertStatus(input: Pick<Application, "userId" | "jobId" | "status">) {
    const existing = await this.findByUserAndJob(input.userId, input.jobId);
    if (existing) {
      existing.status = input.status;
      existing.updatedAt = this.s.now();
      return existing;
    }
    const app: Application = { id: this.s.nextId(), ...input, createdAt: this.s.now(), updatedAt: this.s.now() };
    this.s.applications.push(app);
    return app;
  }
  async delete(id: string) {
    this.s.applications = this.s.applications.filter((a) => a.id !== id);
  }
}

export function fakeRepositories(store: InMemoryStore): Repositories {
  return {
    jobs: new FakeJobRepository(store),
    swipes: new FakeSwipeRepository(store),
    applications: new FakeApplicationRepository(store),
  };
}

export function fakeUnitOfWork(store: InMemoryStore): UnitOfWork {
  return { run: (work) => work(fakeRepositories(store)) };
}

export function makeJob(id: string): JobCard {
  return {
    id,
    title: `Engineer ${id}`,
    companyName: "Acme",
    companyLogoUrl: null,
    location: null,
    remoteType: "remote",
    employmentType: "full_time",
    seniority: "mid",
    salary: null,
    postedAt: null,
    summary: "",
    skills: [],
    applyUrl: `https://example.com/jobs/${id}`,
  };
}
