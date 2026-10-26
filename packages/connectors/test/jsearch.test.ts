import type { ScopeResult, SourceDefinition } from "@ajh/core";
import { describe, expect, it } from "vitest";
import { JSearchConnector, createConnectorRegistry, jsearchConfig, normalizeJSearchJob, type HttpClient, type JSearchJob } from "../src";

// Shape based on JSearch's documented search response. Re-record from a live call once a key exists.
const job = (id: string, overrides: Partial<JSearchJob> = {}): JSearchJob => ({
  job_id: id,
  job_title: "Senior Software Developer",
  employer_name: "Maple Systems Inc.",
  job_publisher: "LinkedIn",
  job_employment_type: "FULLTIME",
  job_apply_link: "https://www.linkedin.com/jobs/view/123",
  apply_options: [
    { publisher: "LinkedIn", apply_link: "https://www.linkedin.com/jobs/view/123", is_direct: false },
    { publisher: "Maple Systems", apply_link: "https://careers.maple.example/jobs/9", is_direct: true },
  ],
  job_description: "We build TypeScript and React apps on AWS.",
  job_is_remote: false,
  job_posted_at_datetime_utc: "2026-10-24T15:00:00.000Z",
  job_city: "Toronto",
  job_state: "ON",
  job_country: "CA",
  job_min_salary: 110000,
  job_max_salary: 140000,
  job_salary_currency: "CAD",
  job_salary_period: "YEAR",
  ...overrides,
});

describe("normalizeJSearchJob", () => {
  it("maps a Google for Jobs result and prefers the employer's direct apply link", () => {
    expect(normalizeJSearchJob(job("abc"))).toMatchObject({
      externalId: "jsearch:abc",
      companyName: "Maple Systems Inc.",
      location: "Toronto, ON",
      country: "CA",
      employmentType: "full_time",
      seniority: "senior",
      applyUrl: "https://careers.maple.example/jobs/9",
      salaryMin: 110000,
      salaryCurrency: "CAD",
      salaryPeriod: "year",
      skills: ["TypeScript", "React", "AWS"],
    });
  });

  it("drops a salary whose currency isn't stated rather than guessing", () => {
    const n = normalizeJSearchJob(job("x", { job_salary_currency: null }))!;
    expect([n.salaryMin, n.salaryMax, n.salaryCurrency]).toEqual([null, null, null]);
  });

  it("skips results missing an id, title, employer, or a real link", () => {
    expect(normalizeJSearchJob(job("x", { job_title: "" }))).toBeNull();
    expect(normalizeJSearchJob(job("x", { employer_name: undefined }))).toBeNull();
    expect(normalizeJSearchJob(job("x", { apply_options: [], job_apply_link: "javascript:alert(1)" }))).toBeNull();
  });
});

describe("JSearchConnector", () => {
  const source = (config: Record<string, unknown>): SourceDefinition => ({
    id: "s",
    key: "jsearch",
    name: "JSearch",
    kind: "aggregator",
    enabled: true,
    config,
  });

  const recordingHttp = (pageSize: number) => {
    const urls: string[] = [];
    const http: HttpClient = {
      async getJson<T>(url: string) {
        urls.push(url);
        return { status: "OK", data: Array.from({ length: pageSize }, (_, i) => job(`${urls.length}-${i}`)) } as T;
      },
    };
    return { http, urls };
  };

  async function collect(iter: AsyncIterable<ScopeResult>) {
    const out: ScopeResult[] = [];
    for await (const r of iter) out.push(r);
    return out;
  }

  it("marks results as partial so absent jobs aren't expired", async () => {
    const { http } = recordingHttp(3);
    const [r] = await collect(new JSearchConnector(http).fetch(source({ queries: ["developer jobs in Canada"] })));
    expect(r).toMatchObject({ scope: "q-developer-jobs-in-canada", ok: true, complete: false });
  });

  it("never exceeds the per-run request budget", async () => {
    const { http, urls } = recordingHttp(10); // full pages → would keep paging
    await collect(
      new JSearchConnector(http).fetch(
        source({ queries: ["a", "b", "c"], pagesPerQuery: 5, maxRequestsPerRun: 4 }),
      ),
    );
    expect(urls).toHaveLength(4);
    expect(new URL(urls[0]!).searchParams.get("country")).toBe("ca");
    expect(new URL(urls[0]!).searchParams.get("num_pages")).toBe("1");
  });

  it("stops paging when a page comes back short", async () => {
    const { http, urls } = recordingHttp(4);
    await collect(new JSearchConnector(http).fetch(source({ queries: ["a"], pagesPerQuery: 5, maxRequestsPerRun: 10 })));
    expect(urls).toHaveLength(1);
  });

  it("sanitizes config", () => {
    expect(jsearchConfig({ queries: ["x", 3, " "], country: "evil", datePosted: "forever", maxRequestsPerRun: 9999 })).toEqual({
      queries: ["x"],
      country: "ca",
      datePosted: "3days",
      pagesPerQuery: 1,
      maxRequestsPerRun: 100,
    });
  });

  it("is only registered when a key is configured", () => {
    expect(createConnectorRegistry().keys()).not.toContain("jsearch");
    expect(createConnectorRegistry({ jsearchApiKey: "k" }).keys()).toContain("jsearch");
  });
});
