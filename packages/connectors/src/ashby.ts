import {
  detectEmploymentType,
  detectRemoteType,
  detectSeniority,
  extractSkills,
  htmlToText,
  mentionsCanada,
  preferCanadianLocations,
  type EmploymentType,
  type NormalizedJobInput,
  type RemoteType,
  type SalaryPeriod,
} from "@ajh/core";
import { BoardConnector, displayName, type BoardRef } from "./board-connector";

// https://developers.ashbyhq.com/docs/public-job-posting-api (public, no key)
export interface AshbyJob {
  id: string;
  title: string;
  location?: string | null;
  secondaryLocations?: Array<{ location?: string | null }> | null;
  employmentType?: string | null;
  isListed?: boolean;
  isRemote?: boolean | null;
  workplaceType?: string | null;
  publishedAt?: string | null;
  jobUrl: string;
  descriptionHtml?: string | null;
  descriptionPlain?: string | null;
  address?: { postalAddress?: { addressCountry?: string | null; addressLocality?: string | null } | null } | null;
  compensation?: {
    summaryComponents?: Array<{
      compensationType?: string;
      interval?: string;
      currencyCode?: string | null;
      minValue?: number | null;
      maxValue?: number | null;
    }> | null;
  } | null;
}

export class AshbyConnector extends BoardConnector {
  readonly key = "ashby";

  protected async fetchBoard(board: BoardRef): Promise<NormalizedJobInput[]> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board.token)}?includeCompensation=true`;
    const { jobs } = await this.http.getJson<{ jobs: AshbyJob[] }>(url);
    return jobs.filter((j) => j.isListed !== false).map((j) => normalizeAshbyJob(j, board));
  }
}

const EMPLOYMENT: Record<string, EmploymentType> = {
  FullTime: "full_time",
  PartTime: "part_time",
  Contract: "contract",
  Intern: "internship",
  Temporary: "temporary",
};
const WORKPLACE: Record<string, RemoteType> = { Remote: "remote", Hybrid: "hybrid", OnSite: "onsite" };
const PERIOD: Record<string, SalaryPeriod> = { "1 YEAR": "year", "1 MONTH": "month", "1 HOUR": "hour" };

export function normalizeAshbyJob(j: AshbyJob, board: BoardRef): NormalizedJobInput {
  const locations = [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)];
  const location = preferCanadianLocations(locations);
  const addressCountry = j.address?.postalAddress?.addressCountry ?? "";
  const descriptionText = j.descriptionPlain?.trim() || (j.descriptionHtml ? htmlToText(j.descriptionHtml) : "");
  const salary = j.compensation?.summaryComponents?.find((c) => c.compensationType === "Salary");

  return {
    externalId: `${board.token}:${j.id}`,
    title: j.title.trim(),
    companyName: displayName(board),
    descriptionHtml: null,
    descriptionText,
    location,
    country: mentionsCanada(addressCountry) || locations.some(mentionsCanada) ? "CA" : null,
    remoteType: WORKPLACE[j.workplaceType ?? ""] ?? (j.isRemote ? "remote" : detectRemoteType(j.title, location)),
    employmentType: EMPLOYMENT[j.employmentType ?? ""] ?? detectEmploymentType(j.title),
    seniority: detectSeniority(j.title),
    salaryMin: salary?.minValue ?? null,
    salaryMax: salary?.maxValue ?? null,
    salaryCurrency: salary?.currencyCode ?? null,
    salaryPeriod: salary ? (PERIOD[salary.interval ?? ""] ?? "year") : null,
    postedAt: j.publishedAt ? new Date(j.publishedAt) : null,
    applyUrl: j.jobUrl,
    skills: extractSkills(`${j.title}\n${descriptionText}`),
  };
}
