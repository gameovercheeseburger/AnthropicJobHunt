// Domain entities and value objects for job listings. No framework or DB imports here.

export const REMOTE_TYPES = ["onsite", "hybrid", "remote", "unknown"] as const;
export type RemoteType = (typeof REMOTE_TYPES)[number];

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "temporary",
  "unknown",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const SENIORITIES = [
  "intern",
  "junior",
  "mid",
  "senior",
  "lead",
  "executive",
  "unknown",
] as const;
export type Seniority = (typeof SENIORITIES)[number];

export type SalaryPeriod = "hour" | "month" | "year";

/** Value object: an immutable salary range. */
export class Salary {
  private constructor(
    readonly min: number | null,
    readonly max: number | null,
    readonly currency: string,
    readonly period: SalaryPeriod,
  ) {}

  static create(input: {
    min?: number | null;
    max?: number | null;
    currency?: string | null;
    period?: SalaryPeriod | null;
  }): Salary | null {
    const min = input.min ?? null;
    const max = input.max ?? null;
    if (min === null && max === null) return null;
    if (min !== null && max !== null && min > max) {
      return new Salary(max, min, input.currency ?? "USD", input.period ?? "year");
    }
    return new Salary(min, max, input.currency ?? "USD", input.period ?? "year");
  }

  format(locale = "en-US"): string {
    const fmt = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: this.currency,
      maximumFractionDigits: 0,
      notation: this.period === "year" ? "compact" : "standard",
    });
    const suffix = { hour: "/hr", month: "/mo", year: "/yr" }[this.period];
    if (this.min !== null && this.max !== null) {
      return `${fmt.format(this.min)}–${fmt.format(this.max)}${suffix}`;
    }
    return `${this.min !== null ? "from " : "up to "}${fmt.format((this.min ?? this.max)!)}${suffix}`;
  }
}

/** The card-sized view of a job used by the swipe feed. */
export interface JobCard {
  id: string;
  title: string;
  companyName: string;
  companyLogoUrl: string | null;
  location: string | null;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  seniority: Seniority;
  salary: Salary | null;
  postedAt: Date | null;
  summary: string;
  skills: string[];
  applyUrl: string;
}
