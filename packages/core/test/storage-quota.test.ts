import { beforeEach, describe, expect, it } from "vitest";
import { RESUME_MIME_TYPES, ResumeService, StorageFullError, StorageQuotaService, type ResumeParser } from "../src";
import { FakeFileStorage, FakeResumeRepository, InMemoryStore, fakeRepositories, fakeUnitOfWork } from "./fakes";

const NOW = new Date("2026-10-26T12:00:00Z");

describe("StorageQuotaService", () => {
  let store: InMemoryStore;
  let storage: FakeFileStorage;
  let repo: FakeResumeRepository;

  /** Adds a resume record + its stored file. */
  async function addResume(userId: string, bytes: number) {
    const record = await repo.createMaster({ userId, fileName: "r.pdf", fileKey: `resumes/${userId}/${store.resumes.length}`, mimeType: "application/pdf", sizeBytes: bytes });
    await storage.put(record.fileKey, new Uint8Array(bytes));
    return record;
  }

  const quota = (limitBytes: number, graceMs = 60_000) =>
    new StorageQuotaService(storage, repo, { limitBytes, orphanGraceMs: graceMs, now: () => NOW });

  beforeEach(() => {
    store = new InMemoryStore();
    storage = new FakeFileStorage();
    repo = new FakeResumeRepository(store);
  });

  it("allows uploads that fit without deleting anything", async () => {
    await addResume("u1", 400);
    await quota(1000).ensureRoom(500);
    expect(storage.files.size).toBe(1);
  });

  it("deletes replaced resumes oldest-first to make room, never the current one", async () => {
    const oldest = await addResume("u1", 300); // replaced
    const middle = await addResume("u1", 300); // replaced
    const current = await addResume("u1", 300); // u1's master
    await quota(1000).ensureRoom(400); // 900 + 400 > 1000 → must free space

    expect(storage.files.has(oldest.fileKey)).toBe(false);
    expect(storage.files.has(current.fileKey)).toBe(true);
    expect(store.resumes.map((r) => r.id)).not.toContain(oldest.id);
    // Target = min(80% of 1000, 1000 − 400) = 600; deleting the oldest reaches it, so the middle survives.
    expect(storage.files.has(middle.fileKey)).toBe(true);
  });

  it("removes orphaned files before touching any resume", async () => {
    const replaced = await addResume("u1", 300);
    await addResume("u1", 300);
    await storage.put("resumes/ghost/leftover.pdf", new Uint8Array(500)); // no database record
    await quota(1000).ensureRoom(100);

    expect(storage.files.has("resumes/ghost/leftover.pdf")).toBe(false);
    expect(storage.files.has(replaced.fileKey)).toBe(true); // orphan cleanup was enough
  });

  it("leaves very recent orphans alone (an upload may still be in progress)", async () => {
    await storage.put("resumes/u1/in-flight.pdf", new Uint8Array(900));
    storage.modified.set("resumes/u1/in-flight.pdf", new Date(NOW.getTime() - 1000));
    await expect(quota(1000, 60_000).ensureRoom(200)).rejects.toBeInstanceOf(StorageFullError);
    expect(storage.files.has("resumes/u1/in-flight.pdf")).toBe(true);
  });

  it("hard-stops when only current resumes remain", async () => {
    await addResume("u1", 500);
    await addResume("u2", 400);
    await expect(quota(1000).ensureRoom(200)).rejects.toBeInstanceOf(StorageFullError);
    expect(storage.files.size).toBe(2); // nobody's current resume was deleted
  });

  it("routine maintenance only acts above the high-water mark", async () => {
    await addResume("u1", 300);
    await addResume("u1", 300);
    const below = await quota(1000).maintain(); // 600 ≤ 900
    expect(below).toMatchObject({ deletedOrphans: 0, deletedSuperseded: 0 });

    await addResume("u1", 350); // 950 > 900
    const above = await quota(1000).maintain();
    expect(above.usageAfterBytes).toBeLessThanOrEqual(800);
    expect(above.deletedSuperseded).toBeGreaterThan(0);
  });
});

describe("ResumeService with a storage cap", () => {
  it("refuses an upload that cannot fit, before storing anything", async () => {
    const store = new InMemoryStore();
    const storage = new FakeFileStorage();
    const repos = fakeRepositories(store);
    const parser: ResumeParser = { parse: async () => { throw new Error("should not be called"); } };
    const service = new ResumeService({
      uow: fakeUnitOfWork(store),
      repos,
      storage,
      extractors: [{ supports: () => true, extract: async () => "text" }],
      parser,
      quota: new StorageQuotaService(storage, repos.resumes, { limitBytes: 100 }),
    });

    await expect(
      service.uploadMasterResume("u1", { fileName: "r.docx", mimeType: RESUME_MIME_TYPES.docx, bytes: new Uint8Array(200) }),
    ).rejects.toBeInstanceOf(StorageFullError);
    expect(storage.files.size).toBe(0);
    expect(store.resumes).toHaveLength(0);
  });
});
