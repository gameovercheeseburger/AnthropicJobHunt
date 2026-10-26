import { describe, expect, it } from "vitest";
import {
  ConnectorRegistry,
  IngestionService,
  detectEmploymentType,
  detectRemoteType,
  detectSeniority,
  extractSkills,
  htmlToText,
  jobFingerprint,
  mentionsCanada,
  normalizeCompanyName,
  preferCanadianLocations,
  summarize,
  type IngestionCounts,
  type IngestionRepository,
  type NormalizedJobInput,
  type ScopeResult,
  type SourceConnector,
  type SourceDefinition,
} from "../src";

describe("normalizers", () => {
  it.each([
    ["Toronto, Ontario - Canada", true],
    ["Remote - Canada", true],
    ["Vancouver, BC", true],
    ["Montréal", true],
    ["Waterloo, ON", true],
    ["London, ON", true],
    ["London, UK", false],
    ["Victoria, Australia", false],
    ["San Francisco, CA", false], // CA = California, not Canada
    ["Remote - US", false],
    [null, false],
  ])("mentionsCanada(%s) = %s", (loc, expected) => {
    expect(mentionsCanada(loc)).toBe(expected);
  });

  it("puts Canadian locations first and drops duplicates", () => {
    expect(preferCanadianLocations(["New York, NY", "Toronto, ON", "Toronto, ON", null])).toBe("Toronto, ON");
    expect(preferCanadianLocations(["New York, NY"])).toBe("New York, NY");
  });

  it("turns double-escaped HTML into readable text", () => {
    const html = "&lt;p&gt;Build &amp;amp; ship.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;TypeScript&lt;/li&gt;&lt;/ul&gt;";
    expect(htmlToText(html)).toBe("Build & ship.\n\n• TypeScript");
  });

  it("summarizes at a word boundary", () => {
    const s = summarize(`Intro\n${"word ".repeat(100)}`, 50);
    expect(s.length).toBeLessThanOrEqual(51);
    expect(s.endsWith("…")).toBe(true);
  });

  it("detects remote type, employment type, and seniority", () => {
    expect(detectRemoteType("AI Developer (Remote)")).toBe("remote");
    expect(detectRemoteType("Hybrid - Toronto")).toBe("hybrid");
    expect(detectRemoteType("Toronto")).toBe("unknown");
    expect(detectEmploymentType("Permanent Full Time")).toBe("full_time");
    expect(detectEmploymentType("Summer Co-op 2027")).toBe("internship");
    expect(detectSeniority("Sr. Software Engineer")).toBe("senior");
    expect(detectSeniority("Staff Engineer")).toBe("lead");
    expect(detectSeniority("Director, Engineering")).toBe("executive");
    expect(detectSeniority("New Grad Software Engineer")).toBe("junior");
    expect(detectSeniority("Software Engineer")).toBe("unknown");
  });

  it("extracts known skills without false positives", () => {
    expect(extractSkills("We use TypeScript, React and Postgres on AWS.")).toEqual([
      "TypeScript",
      "React",
      "PostgreSQL",
      "AWS",
    ]);
    expect(extractSkills("JavaScript experience")).toEqual(["JavaScript"]); // not "Java"
  });

  it("fingerprints the same job identically across sources", () => {
    const a = jobFingerprint({ companyName: "Stripe, Inc.", title: "Backend Engineer (Remote)", location: "Toronto, ON" });
    const b = jobFingerprint({ companyName: "stripe", title: "Backend Engineer", location: "Toronto - Canada" });
    expect(a).toBe(b);
    expect(normalizeCompanyName("Acme Corp.")).toBe("acme");
  });
});

// ---- IngestionService --------------------------------------------------------------------

const job = (id: string, overrides: Partial<NormalizedJobInput> = {}): NormalizedJobInput => ({
  externalId: id,
  title: `Engineer ${id}`,
  companyName: "Acme",
  descriptionHtml: null,
  descriptionText: "",
  location: "Toronto, ON",
  country: "CA",
  remoteType: "unknown",
  employmentType: "full_time",
  seniority: "unknown",
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  salaryPeriod: null,
  postedAt: null,
  applyUrl: "https://example.com",
  skills: [],
  ...overrides,
});

class FakeIngestionRepo implements IngestionRepository {
  stored = new Map<string, NormalizedJobInput>();
  expiredScopes: string[] = [];
  runs: Array<{ counts: IngestionCounts; error: string | null }> = [];
  async startRun() {
    return { runId: "run-1", startedAt: new Date("2026-10-25T00:00:00Z") };
  }
  async finishRun(_id: string, result: { counts: IngestionCounts; error: string | null }) {
    this.runs.push(result);
  }
  async upsertJob(_sourceId: string, j: NormalizedJobInput) {
    const existed = this.stored.has(j.externalId);
    this.stored.set(j.externalId, j);
    return existed ? ("updated" as const) : ("created" as const);
  }
  async expireUnseen(_sourceId: string, scope: string) {
    this.expiredScopes.push(scope);
    return 0;
  }
  async expireOverdue() {
    return 0;
  }
}

const source: SourceDefinition = { id: "s1", key: "fake", name: "Fake", kind: "ats", config: {}, enabled: true };

function connectorYielding(results: ScopeResult[]): SourceConnector {
  return {
    key: "fake",
    async *fetch() {
      yield* results;
    },
  };
}

function service(results: ScopeResult[], repo = new FakeIngestionRepo()) {
  return {
    repo,
    svc: new IngestionService({
      sources: { listEnabled: async () => [source], findByKey: async () => source, ensureDefaults: async () => {} },
      ingestion: repo,
      connectors: new ConnectorRegistry([connectorYielding(results)]),
    }),
  };
}

describe("IngestionService", () => {
  it("keeps only Canadian jobs and counts creates vs updates", async () => {
    const { svc, repo } = service([
      { scope: "acme", ok: true, jobs: [job("acme:1"), job("acme:2", { country: "US" }), job("acme:3")] },
    ]);
    const [report] = await svc.runAll();
    expect(report).toMatchObject({ fetched: 3, kept: 2, created: 2, updated: 0, failedScopes: 0 });
    expect([...repo.stored.keys()]).toEqual(["acme:1", "acme:3"]);

    const [second] = await svc.runAll();
    expect(second).toMatchObject({ created: 0, updated: 2 });
  });

  it("never expires jobs of a scope whose fetch failed", async () => {
    const { svc, repo } = service([
      { scope: "good", ok: true, jobs: [job("good:1")] },
      { scope: "broken", ok: false, error: "HTTP 503" },
    ]);
    const [report] = await svc.runAll();
    expect(repo.expiredScopes).toEqual(["good"]);
    expect(report).toMatchObject({ failedScopes: 1, errors: ["broken: HTTP 503"] });
    expect(repo.runs[0]!.error).toContain("HTTP 503");
  });

  it("records a run even when the connector throws", async () => {
    const repo = new FakeIngestionRepo();
    const svc = new IngestionService({
      sources: { listEnabled: async () => [source], findByKey: async () => source, ensureDefaults: async () => {} },
      ingestion: repo,
      connectors: new ConnectorRegistry([
        {
          key: "fake",
          // eslint-disable-next-line require-yield
          async *fetch() {
            throw new Error("network down");
          },
        },
      ]),
    });
    const [report] = await svc.runAll();
    expect(report!.errors).toEqual(["network down"]);
    expect(repo.runs).toHaveLength(1);
  });

  it("rejects duplicate connector keys", () => {
    expect(() => new ConnectorRegistry([connectorYielding([]), connectorYielding([])])).toThrow(/twice/);
  });
});
