import type { JobCard } from "@ajh/core";

/** Presenter: turns a domain JobCard into plain, serializable data for client components. */
export interface JobCardView {
  id: string;
  title: string;
  companyName: string;
  companyInitial: string;
  location: string | null;
  tags: string[];
  salaryLabel: string | null;
  postedLabel: string | null;
  summary: string;
  skills: string[];
  applyUrl: string;
}

const REMOTE_LABEL = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site", unknown: null } as const;
const SENIORITY_LABEL = {
  intern: "Intern",
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead",
  executive: "Executive",
  unknown: null,
} as const;
const EMPLOYMENT_LABEL = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
  unknown: null,
} as const;

export function formatPostedAgo(postedAt: Date | null, now = new Date()): string | null {
  if (!postedAt) return null;
  const days = Math.floor((now.getTime() - postedAt.getTime()) / 86_400_000);
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 30) return `Posted ${days} days ago`;
  return `Posted ${Math.floor(days / 30)} mo ago`;
}

export function presentJobCard(job: JobCard, now = new Date()): JobCardView {
  return {
    id: job.id,
    title: job.title,
    companyName: job.companyName,
    companyInitial: job.companyName.trim().charAt(0).toUpperCase() || "?",
    location: job.location,
    tags: [REMOTE_LABEL[job.remoteType], SENIORITY_LABEL[job.seniority], EMPLOYMENT_LABEL[job.employmentType]].filter(
      (t): t is NonNullable<typeof t> => t !== null,
    ),
    salaryLabel: job.salary?.format() ?? null,
    postedLabel: formatPostedAgo(job.postedAt, now),
    summary: job.summary,
    skills: job.skills,
    applyUrl: job.applyUrl,
  };
}
