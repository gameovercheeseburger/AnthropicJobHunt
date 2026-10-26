import {
  detectEmploymentType,
  detectRemoteType,
  detectSeniority,
  extractSkills,
  mentionsCanada,
  type EmploymentType,
  type NormalizedJobInput,
  type SalaryPeriod,
  type ScopeResult,
  type SourceConnector,
  type SourceDefinition,
} from "@ajh/core";
import type { HttpClient } from "./http";

/**
 * JSearch (RapidAPI) returns Google for Jobs results, which include postings from LinkedIn,
 * Indeed, Glassdoor, Job Bank and company sites, via an API whose terms allow this use.
 * Every field is treated as optional: the response schema isn't formally published.
 */
export interface JSearchJob {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_publisher?: string;
  job_employment_type?: string | null;
  job_apply_link?: string;
  apply_options?: Array<{ publisher?: string; apply_link?: string; is_direct?: boolean }> | null;
  job_description?: string | null;
  job_is_remote?: boolean | null;
  job_posted_at_datetime_utc?: string | null;
  job_city?: string | null;
  job_state?: string | null;
  job_country?: string | null;
  job_location?: string | null;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_currency?: string | null;
  job_salary_period?: string | null;
}

export interface JSearchConfig {
  queries: string[];
  country: string;
  datePosted: "all" | "today" | "3days" | "week" | "month";
  pagesPerQuery: number;
  /** Hard cap on billable requests per run, to stay inside the RapidAPI plan's quota. */
  maxRequestsPerRun: number;
}

export function jsearchConfig(raw: Record<string, unknown>): JSearchConfig {
  const num = (v: unknown, fallback: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(Math.floor(v), 1), max) : fallback;
  const queries = Array.isArray(raw.queries)
    ? raw.queries.filter((q): q is string => typeof q === "string" && q.trim().length > 0).map((q) => q.trim())
    : [];
  const datePosted = ["all", "today", "3days", "week", "month"].includes(raw.datePosted as string)
    ? (raw.datePosted as JSearchConfig["datePosted"])
    : "3days";
  return {
    queries,
    country: typeof raw.country === "string" && /^[a-z]{2}$/i.test(raw.country) ? raw.country.toLowerCase() : "ca",
    datePosted,
    pagesPerQuery: num(raw.pagesPerQuery, 1, 10),
    maxRequestsPerRun: num(raw.maxRequestsPerRun, 6, 100),
  };
}

const HOST = "jsearch.p.rapidapi.com";

/** Strategy + Adapter for the JSearch aggregator. One scope per search query. */
export class JSearchConnector implements SourceConnector {
  readonly key = "jsearch";

  /** `http` must send the RapidAPI headers (see createRapidApiHttpClient). */
  constructor(private readonly http: HttpClient) {}

  async *fetch(source: SourceDefinition): AsyncIterable<ScopeResult> {
    const config = jsearchConfig(source.config);
    let budget = config.maxRequestsPerRun;

    for (const query of config.queries) {
      if (budget <= 0) break;
      const scope = `q-${query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
      const jobs: NormalizedJobInput[] = [];
      try {
        for (let page = 1; page <= config.pagesPerQuery && budget > 0; page++) {
          budget--;
          const params = new URLSearchParams({
            query,
            page: String(page),
            num_pages: "1", // one page per request keeps the quota math exact
            country: config.country,
            date_posted: config.datePosted,
          });
          const res = await this.http.getJson<{ status?: string; data?: JSearchJob[] }>(`https://${HOST}/search?${params}`);
          const batch = (res.data ?? []).map(normalizeJSearchJob).filter((j): j is NormalizedJobInput => j !== null);
          jobs.push(...batch);
          if ((res.data?.length ?? 0) < 10) break; // last page
        }
        // Search results are a sample, not the full inventory: absence here doesn't mean a job closed.
        yield { scope, ok: true, jobs, complete: false };
      } catch (err) {
        yield { scope, ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  }
}

const EMPLOYMENT: Record<string, EmploymentType> = {
  FULLTIME: "full_time",
  PARTTIME: "part_time",
  CONTRACTOR: "contract",
  INTERN: "internship",
  TEMPORARY: "temporary",
};
const PERIOD: Record<string, SalaryPeriod> = { YEAR: "year", MONTH: "month", HOUR: "hour" };

export function normalizeJSearchJob(j: JSearchJob): NormalizedJobInput | null {
  const title = j.job_title?.trim();
  const company = j.employer_name?.trim();
  // Prefer a direct employer link over a job-board redirect when one is offered.
  const applyUrl = j.apply_options?.find((o) => o.is_direct && o.apply_link)?.apply_link ?? j.job_apply_link;
  if (!j.job_id || !title || !company || !applyUrl || !/^https?:\/\//.test(applyUrl)) return null;

  const location = j.job_location?.trim() || [j.job_city, j.job_state].filter(Boolean).join(", ") || null;
  const country = j.job_country?.toUpperCase() || (mentionsCanada(location) ? "CA" : null);
  const description = j.job_description?.trim() ?? "";
  // Only keep a salary when its currency is stated, so a CAD range is never shown as USD.
  const hasSalary = (j.job_min_salary ?? j.job_max_salary) != null && Boolean(j.job_salary_currency);

  return {
    externalId: `jsearch:${j.job_id}`,
    title,
    companyName: company,
    descriptionHtml: null,
    descriptionText: description,
    location,
    country,
    remoteType: j.job_is_remote ? "remote" : detectRemoteType(title, location),
    employmentType: EMPLOYMENT[j.job_employment_type?.toUpperCase() ?? ""] ?? detectEmploymentType(title),
    seniority: detectSeniority(title),
    salaryMin: hasSalary ? (j.job_min_salary ?? null) : null,
    salaryMax: hasSalary ? (j.job_max_salary ?? null) : null,
    salaryCurrency: hasSalary ? j.job_salary_currency!.toUpperCase() : null,
    salaryPeriod: hasSalary ? (PERIOD[j.job_salary_period?.toUpperCase() ?? ""] ?? "year") : null,
    postedAt: j.job_posted_at_datetime_utc ? new Date(j.job_posted_at_datetime_utc) : null,
    applyUrl,
    skills: extractSkills(`${title}\n${description}`),
  };
}
