import {
  detectEmploymentType,
  detectRemoteType,
  detectSeniority,
  extractSkills,
  htmlToText,
  mentionsCanada,
  type NormalizedJobInput,
} from "@ajh/core";
import { BoardConnector, displayName, type BoardRef } from "./board-connector";

// https://developers.greenhouse.io/job-board.html (public, no key)
export interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string } | null;
  content?: string | null;
  updated_at?: string | null;
  first_published?: string | null;
  company_name?: string | null;
  metadata?: Array<{ name: string; value: unknown }> | null;
  offices?: Array<{ name?: string | null; location?: string | null }> | null;
}

export class GreenhouseConnector extends BoardConnector {
  readonly key = "greenhouse";

  protected async fetchBoard(board: BoardRef): Promise<NormalizedJobInput[]> {
    const base = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.token)}`;
    const { jobs } = await this.http.getJson<{ jobs: GreenhouseJob[] }>(`${base}/jobs?content=true`);
    return jobs.map((job) => normalizeGreenhouseJob(job, board));
  }
}

export function normalizeGreenhouseJob(job: GreenhouseJob, board: BoardRef): NormalizedJobInput {
  const location = job.location?.name?.trim() || null;
  const offices = (job.offices ?? []).map((o) => o.location ?? o.name ?? "").join(" ");
  const meta = (job.metadata ?? [])
    .map((m) => (typeof m.value === "string" ? m.value : Array.isArray(m.value) ? m.value.join(" ") : ""))
    .join(" ");
  const descriptionText = job.content ? htmlToText(job.content) : "";

  return {
    externalId: `${board.token}:${job.id}`,
    title: job.title.trim(),
    companyName: job.company_name?.trim() || displayName(board),
    descriptionHtml: null, // text only: avoids storing third-party markup we'd have to sanitize
    descriptionText,
    location,
    country: mentionsCanada(location) || mentionsCanada(offices) ? "CA" : null,
    remoteType: detectRemoteType(job.title, location, meta),
    employmentType: detectEmploymentType(meta, job.title),
    seniority: detectSeniority(job.title),
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    postedAt: parseDate(job.first_published ?? job.updated_at),
    applyUrl: job.absolute_url,
    skills: extractSkills(`${job.title}\n${descriptionText}`),
  };
}

function parseDate(value: string | null | undefined): Date | null {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}
