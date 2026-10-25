// In-memory adapters for the repository ports. Used to test services without a database.
import type {
  Application,
  ApplicationRepository,
  FileStorage,
  JobCard,
  JobRepository,
  ParsedResume,
  ProfileRepository,
  Repositories,
  ResumeRecord,
  ResumeRepository,
  Swipe,
  SwipeRepository,
  UnitOfWork,
  VerificationWarning,
} from "../src";

export class InMemoryStore {
  jobs = new Map<string, JobCard>();
  swipes: Swipe[] = [];
  applications: Application[] = [];
  resumes: Array<ResumeRecord & { fileKey: string; rawText?: string; parsed?: ParsedResume }> = [];
  profiles = new Map<string, ParsedResume>();
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

type StoredResume = ResumeRecord & { fileKey: string; rawText?: string; parsed?: ParsedResume };

export class FakeResumeRepository implements ResumeRepository {
  constructor(private readonly s: InMemoryStore) {}
  async createMaster(input: Parameters<ResumeRepository["createMaster"]>[0]) {
    this.s.resumes.forEach((r) => r.userId === input.userId && (r.isMaster = false));
    const record: StoredResume = {
      id: `resume-${this.s.resumes.length + 1}`,
      ...input,
      isMaster: true,
      parseStatus: "parsing",
      parseError: null,
      warnings: [],
      createdAt: this.s.now(),
    };
    this.s.resumes.push(record);
    return record;
  }
  async markParsed(id: string, input: { rawText: string; parsed: ParsedResume; warnings: VerificationWarning[] }) {
    Object.assign(this.find(id), { parseStatus: "parsed", ...input });
  }
  async markFailed(id: string, error: string) {
    Object.assign(this.find(id), { parseStatus: "failed", parseError: error });
  }
  async findMaster(userId: string) {
    return this.s.resumes.find((r) => r.userId === userId && r.isMaster) ?? null;
  }
  async findMasterParsed(userId: string) {
    return (await this.findMaster(userId))?.parsed ?? null;
  }
  private find(id: string) {
    const r = this.s.resumes.find((x) => x.id === id);
    if (!r) throw new Error(`no resume ${id}`);
    return r;
  }
}

export class FakeProfileRepository implements ProfileRepository {
  constructor(private readonly s: InMemoryStore) {}
  async replaceFromResume(userId: string, parsed: ParsedResume) {
    this.s.profiles.set(userId, parsed);
  }
  async getView(userId: string) {
    const p = this.s.profiles.get(userId);
    if (!p) return null;
    const { headline, summary, location, links, experiences, education, certifications, skills } = p;
    return { userId, headline, summary, location, links, experiences, education, certifications, skills };
  }
}

export function fakeRepositories(store: InMemoryStore): Repositories {
  return {
    jobs: new FakeJobRepository(store),
    swipes: new FakeSwipeRepository(store),
    applications: new FakeApplicationRepository(store),
    resumes: new FakeResumeRepository(store),
    profiles: new FakeProfileRepository(store),
  };
}

export class FakeFileStorage implements FileStorage {
  files = new Map<string, Uint8Array>();
  async put(key: string, bytes: Uint8Array) {
    this.files.set(key, bytes);
  }
  async get(key: string) {
    const f = this.files.get(key);
    if (!f) throw new Error(`missing ${key}`);
    return f;
  }
  async delete(key: string) {
    this.files.delete(key);
  }
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
