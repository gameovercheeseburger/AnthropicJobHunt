import { beforeEach, describe, expect, it } from "vitest";
import { FeedService, NotFoundError, Salary, SwipeService } from "../src";
import { InMemoryStore, fakeRepositories, fakeUnitOfWork, makeJob } from "./fakes";

const USER = "user-1";

describe("SwipeService", () => {
  let store: InMemoryStore;
  let service: SwipeService;

  beforeEach(() => {
    store = new InMemoryStore();
    ["j1", "j2", "j3"].forEach((id) => store.jobs.set(id, makeJob(id)));
    service = new SwipeService(fakeUnitOfWork(store));
  });

  it("right swipe queues an application for tailoring", async () => {
    const { application } = await service.swipe(USER, "j1", "right");
    expect(application?.status).toBe("queued");
  });

  it("up swipe saves the job", async () => {
    const { application } = await service.swipe(USER, "j1", "up");
    expect(application?.status).toBe("saved");
  });

  it("left swipe creates no application", async () => {
    const { application } = await service.swipe(USER, "j1", "left");
    expect(application).toBeNull();
    expect(store.applications).toHaveLength(0);
  });

  it("changing a saved job to pass removes the saved application", async () => {
    await service.swipe(USER, "j1", "up");
    await service.swipe(USER, "j1", "left");
    expect(store.applications).toHaveLength(0);
  });

  it("never downgrades an application the user already moved forward", async () => {
    await service.swipe(USER, "j1", "right");
    store.applications[0]!.status = "applied";
    const { application } = await service.swipe(USER, "j1", "left");
    expect(application?.status).toBe("applied");
  });

  it("rejects swipes on unknown jobs", async () => {
    await expect(service.swipe(USER, "nope", "right")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("swiped jobs leave the deck and undo brings the last one back", async () => {
    const feed = new FeedService(fakeRepositories(store).jobs);
    await service.swipe(USER, "j1", "left");
    await service.swipe(USER, "j2", "right");
    expect((await feed.getDeck(USER)).map((j) => j.id)).toEqual(["j3"]);

    expect(await service.undoLast(USER)).toBe("j2");
    expect(store.applications).toHaveLength(0);
    expect((await feed.getDeck(USER)).map((j) => j.id)).toEqual(["j2", "j3"]);
  });

  it("undo keeps applications the user already progressed", async () => {
    await service.swipe(USER, "j1", "right");
    store.applications[0]!.status = "interviewing";
    await service.undoLast(USER);
    expect(store.applications[0]?.status).toBe("interviewing");
  });

  it("undo with no history is a no-op", async () => {
    expect(await service.undoLast(USER)).toBeNull();
  });
});

describe("Salary value object", () => {
  it("returns null when no bounds are given", () => {
    expect(Salary.create({})).toBeNull();
  });

  it("swaps inverted bounds", () => {
    const s = Salary.create({ min: 200_000, max: 150_000 })!;
    expect([s.min, s.max]).toEqual([150_000, 200_000]);
  });

  it("formats ranges compactly", () => {
    expect(Salary.create({ min: 150_000, max: 200_000 })!.format()).toBe("$150K–$200K/yr");
    expect(Salary.create({ min: 45, period: "hour" })!.format()).toBe("from $45/hr");
  });
});
