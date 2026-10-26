import type { EmploymentType, RemoteType, SalaryPeriod, Seniority } from "./job";

export const SOURCE_KINDS = ["ats", "aggregator", "schema_org", "direct"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** A job as every connector must hand it over: already normalized, ready to store. */
export interface NormalizedJobInput {
  /** Unique within the source and prefixed with its scope (e.g. "stripe:12345"). */
  externalId: string;
  title: string;
  companyName: string;
  descriptionHtml: string | null;
  descriptionText: string;
  location: string | null;
  /** ISO 3166-1 alpha-2, e.g. "CA". Null when unknown. */
  country: string | null;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  seniority: Seniority;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
  postedAt: Date | null;
  applyUrl: string;
  skills: string[];
}

/**
 * One unit of fetching inside a source, e.g. a single company's board.
 * Failures are per scope, so one broken board never expires another board's jobs.
 */
export type ScopeResult =
  | { scope: string; ok: true; jobs: NormalizedJobInput[] }
  | { scope: string; ok: false; error: string };

export interface SourceDefinition {
  id: string;
  key: string;
  name: string;
  kind: SourceKind;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface IngestionCounts {
  fetched: number;
  kept: number;
  created: number;
  updated: number;
  expired: number;
  failedScopes: number;
}

export interface IngestionReport extends IngestionCounts {
  sourceKey: string;
  errors: string[];
}
