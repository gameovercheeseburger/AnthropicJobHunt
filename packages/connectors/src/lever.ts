import {
  detectEmploymentType,
  detectRemoteType,
  detectSeniority,
  extractSkills,
  htmlToText,
  mentionsCanada,
  preferCanadianLocations,
  type NormalizedJobInput,
  type RemoteType,
  type SalaryPeriod,
} from "@ajh/core";
import { BoardConnector, displayName, type BoardRef } from "./board-connector";

// https://github.com/lever/postings-api (public, no key)
export interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  country?: string | null;
  workplaceType?: string | null;
  descriptionPlain?: string | null;
  description?: string | null;
  lists?: Array<{ text: string; content: string }> | null;
  additionalPlain?: string | null;
  categories?: {
    commitment?: string | null;
    location?: string | null;
    allLocations?: string[] | null;
    team?: string | null;
  } | null;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string } | null;
}

export class LeverConnector extends BoardConnector {
  readonly key = "lever";

  protected async fetchBoard(board: BoardRef): Promise<NormalizedJobInput[]> {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(board.token)}?mode=json`;
    const postings = await this.http.getJson<LeverPosting[]>(url);
    return postings.map((p) => normalizeLeverPosting(p, board));
  }
}

const WORKPLACE: Record<string, RemoteType> = { remote: "remote", hybrid: "hybrid", "on-site": "onsite", onsite: "onsite" };
const INTERVAL: Record<string, SalaryPeriod> = {
  "per-year-salary": "year",
  "per-month-salary": "month",
  "per-hour-wage": "hour",
};

export function normalizeLeverPosting(p: LeverPosting, board: BoardRef): NormalizedJobInput {
  const locations = [p.categories?.location, ...(p.categories?.allLocations ?? [])];
  const location = preferCanadianLocations(locations);
  const listsText = (p.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
  const descriptionText = [p.descriptionPlain ?? (p.description ? htmlToText(p.description) : ""), listsText, p.additionalPlain ?? ""]
    .filter(Boolean)
    .join("\n\n")
    .trim();
  const salary = p.salaryRange;

  return {
    externalId: `${board.token}:${p.id}`,
    title: p.text.trim(),
    companyName: displayName(board),
    descriptionHtml: null,
    descriptionText,
    location,
    country: p.country?.toUpperCase() === "CA" || locations.some(mentionsCanada) ? "CA" : (p.country?.toUpperCase() ?? null),
    remoteType: WORKPLACE[p.workplaceType?.toLowerCase() ?? ""] ?? detectRemoteType(p.text, location),
    employmentType: detectEmploymentType(p.categories?.commitment, p.text),
    seniority: detectSeniority(p.text),
    salaryMin: salary?.min ?? null,
    salaryMax: salary?.max ?? null,
    salaryCurrency: salary?.currency ?? null,
    salaryPeriod: salary ? (INTERVAL[salary.interval ?? ""] ?? "year") : null,
    postedAt: p.createdAt ? new Date(p.createdAt) : null,
    applyUrl: p.hostedUrl,
    skills: extractSkills(`${p.text}\n${descriptionText}`),
  };
}
