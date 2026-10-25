import { Salary, type JobCard } from "@ajh/core";
import { describe, expect, it } from "vitest";
import { resolveSwipe } from "../components/swipe/swipe-gesture";
import { formatPostedAgo, presentJobCard } from "../lib/presenters/job-card";

const still = { x: 0, y: 0 };

describe("resolveSwipe", () => {
  it("commits by distance", () => {
    expect(resolveSwipe({ x: 150, y: 10 }, still)).toBe("right");
    expect(resolveSwipe({ x: -150, y: 10 }, still)).toBe("left");
    expect(resolveSwipe({ x: 10, y: -150 }, still)).toBe("up");
  });

  it("commits on a fast flick even when short", () => {
    expect(resolveSwipe({ x: 40, y: 0 }, { x: 900, y: 0 })).toBe("right");
  });

  it("ignores small drags and downward swipes", () => {
    expect(resolveSwipe({ x: 40, y: 20 }, still)).toBeNull();
    expect(resolveSwipe({ x: 0, y: 200 }, still)).toBeNull();
  });
});

describe("presentJobCard", () => {
  const job: JobCard = {
    id: "1",
    title: "Engineer",
    companyName: "northwind",
    companyLogoUrl: null,
    location: "Remote",
    remoteType: "remote",
    employmentType: "full_time",
    seniority: "unknown",
    salary: Salary.create({ min: 100_000, max: 120_000 }),
    postedAt: new Date("2026-10-20T00:00:00Z"),
    summary: "",
    skills: [],
    applyUrl: "https://example.com",
  };

  it("produces plain serializable labels and drops unknown tags", () => {
    const view = presentJobCard(job, new Date("2026-10-25T12:00:00Z"));
    expect(view).toMatchObject({
      companyInitial: "N",
      tags: ["Remote", "Full-time"],
      salaryLabel: "$100K–$120K/yr",
      postedLabel: "Posted 5 days ago",
    });
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it("formats recency", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    expect(formatPostedAgo(new Date("2026-10-25T08:00:00Z"), now)).toBe("Posted today");
    expect(formatPostedAgo(null, now)).toBeNull();
  });
});
