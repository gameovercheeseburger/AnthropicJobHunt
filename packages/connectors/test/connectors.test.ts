import { readFileSync } from "node:fs";
import path from "node:path";
import type { ScopeResult, SourceDefinition } from "@ajh/core";
import { describe, expect, it, vi } from "vitest";
import {
  AshbyConnector,
  FetchHttpClient,
  GreenhouseConnector,
  HttpError,
  LeverConnector,
  boardsFromConfig,
  normalizeAshbyJob,
  normalizeLeverPosting,
  type HttpClient,
} from "../src";

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8"));

/** HttpClient that serves recorded responses by URL substring. */
const fakeHttp = (routes: Record<string, unknown>): HttpClient => ({
  async getJson<T>(url: string) {
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    if (!hit) throw new HttpError(404, url);
    return hit[1] as T;
  },
});

const source = (key: string, boards: unknown[]): SourceDefinition => ({
  id: "s",
  key,
  name: key,
  kind: "ats",
  enabled: true,
  config: { boards },
});

async function collect(iter: AsyncIterable<ScopeResult>) {
  const out: ScopeResult[] = [];
  for await (const r of iter) out.push(r);
  return out;
}

describe("GreenhouseConnector (recorded Geotab board)", () => {
  it("normalizes real postings", async () => {
    const connector = new GreenhouseConnector(fakeHttp({ "boards/geotab/jobs": fixture("greenhouse-geotab.json") }));
    const [result] = await collect(connector.fetch(source("greenhouse", [{ token: "geotab", name: "Geotab" }])));
    if (!result?.ok) throw new Error("expected ok");
    const job = result.jobs[0]!;
    expect(job.externalId).toMatch(/^geotab:\d+$/);
    expect(job.companyName).toBe("Geotab");
    expect(job.country).toBe("CA");
    expect(job.applyUrl).toMatch(/^https:\/\/job-boards\.greenhouse\.io\/geotab\/jobs\//);
    expect(job.descriptionText).not.toMatch(/<|&lt;/); // HTML fully stripped
    expect(job.postedAt).toBeInstanceOf(Date);
  });
});

describe("LeverConnector (recorded Spotify board)", () => {
  it("normalizes real postings, including non-Canadian ones the service will filter out", async () => {
    const connector = new LeverConnector(fakeHttp({ "postings/spotify": fixture("lever-spotify.json") }));
    const [result] = await collect(connector.fetch(source("lever", ["spotify"])));
    if (!result?.ok) throw new Error("expected ok");
    const job = result.jobs[0]!;
    expect(job.externalId).toMatch(/^spotify:/);
    expect(job.companyName).toBe("Spotify");
    expect(job.country).toBe("US");
    expect(job.remoteType).toBe("hybrid");
  });

  it("detects a Canadian posting and maps salary ranges", () => {
    const job = normalizeLeverPosting(
      {
        id: "x",
        text: "Senior Data Engineer",
        hostedUrl: "https://jobs.lever.co/acme/x",
        categories: { location: "Toronto, ON", commitment: "Full-time" },
        salaryRange: { min: 120000, max: 150000, currency: "CAD", interval: "per-year-salary" },
      },
      { token: "acme", name: "Acme" },
    );
    expect(job).toMatchObject({
      country: "CA",
      seniority: "senior",
      employmentType: "full_time",
      salaryMin: 120000,
      salaryCurrency: "CAD",
      salaryPeriod: "year",
    });
  });
});

describe("AshbyConnector (recorded Wealthsimple board)", () => {
  it("normalizes real postings with structured CAD compensation", async () => {
    const connector = new AshbyConnector(fakeHttp({ "job-board/wealthsimple": fixture("ashby-wealthsimple.json") }));
    const [result] = await collect(connector.fetch(source("ashby", [{ token: "wealthsimple", name: "Wealthsimple" }])));
    if (!result?.ok) throw new Error("expected ok");
    const withSalary = result.jobs.find((j) => j.salaryMin !== null);
    expect(result.jobs.every((j) => j.country === "CA")).toBe(true);
    expect(withSalary).toMatchObject({ salaryCurrency: "CAD", salaryPeriod: "year" });
  });

  it("uses the postal address country when the location label is vague", () => {
    const job = normalizeAshbyJob(
      {
        id: "1",
        title: "Engineer",
        location: "Headquarters",
        jobUrl: "https://jobs.ashbyhq.com/acme/1",
        address: { postalAddress: { addressCountry: "Canada" } },
      },
      { token: "acme" },
    );
    expect(job.country).toBe("CA");
    expect(job.companyName).toBe("Acme");
  });
});

describe("board handling", () => {
  it("reports a failing board without stopping the others", async () => {
    const connector = new GreenhouseConnector(fakeHttp({ "boards/geotab/jobs": fixture("greenhouse-geotab.json") }));
    const results = await collect(connector.fetch(source("greenhouse", ["missing", "geotab"])));
    expect(results.map((r) => [r.scope, r.ok])).toEqual([
      ["missing", false],
      ["geotab", true],
    ]);
  });

  it("ignores malformed board tokens from config", () => {
    expect(boardsFromConfig({ boards: ["ok-board", "../etc/passwd", { token: "x y" }, { token: "fine" }] })).toEqual([
      { token: "ok-board" },
      { token: "fine" },
    ]);
  });
});

describe("FetchHttpClient", () => {
  it("retries a 503 and identifies itself", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    const client = new FetchHttpClient({ fetchImpl, minIntervalMs: 0 });
    expect(await client.getJson("https://example.com/x")).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]![1].headers["User-Agent"]).toMatch(/AnthropicJobHunt/);
  });

  it("does not retry a 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 404 }));
    const client = new FetchHttpClient({ fetchImpl, minIntervalMs: 0 });
    await expect(client.getJson("https://example.com/x")).rejects.toBeInstanceOf(HttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
