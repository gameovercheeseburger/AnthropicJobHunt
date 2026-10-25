// Resume domain. "Extracted" = what a parser returns; "Parsed" = after we assign stable ids.

export const RESUME_MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;
export type ResumeMimeType = (typeof RESUME_MIME_TYPES)[keyof typeof RESUME_MIME_TYPES];

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export const PARSE_STATUSES = ["pending", "parsing", "parsed", "failed"] as const;
export type ParseStatus = (typeof PARSE_STATUSES)[number];

export interface ResumeFile {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface ProfileLink {
  label: string;
  url: string;
}

/** Parser output: bullets are plain strings, nothing has an id yet. */
export interface ExtractedResume {
  fullName: string | null;
  headline: string | null;
  summary: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  links: ProfileLink[];
  skills: string[];
  experiences: Array<{
    company: string;
    title: string;
    location: string | null;
    startDate: string | null; // "YYYY-MM" or "YYYY"
    endDate: string | null;
    isCurrent: boolean;
    bullets: string[];
  }>;
  education: Array<{
    school: string;
    degree: string | null;
    field: string | null;
    startDate: string | null;
    endDate: string | null;
  }>;
  certifications: Array<{
    name: string;
    issuer: string | null;
    date: string | null;
  }>;
}

export interface ResumeBullet {
  id: string;
  text: string;
}

export type ParsedExperience = Omit<ExtractedResume["experiences"][number], "bullets"> & {
  id: string;
  bullets: ResumeBullet[];
};

/**
 * The structured master resume. Every experience and bullet has a stable id so
 * tailored versions can cite exactly which original line they rephrase.
 */
export interface ParsedResume extends Omit<ExtractedResume, "experiences"> {
  experiences: ParsedExperience[];
}

export type VerificationField = "company" | "title" | "school" | "degree" | "certification" | "skill" | "bullet";

export interface VerificationWarning {
  field: VerificationField;
  value: string;
  message: string;
}

export interface ResumeRecord {
  id: string;
  userId: string;
  isMaster: boolean;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  parseStatus: ParseStatus;
  parseError: string | null;
  warnings: VerificationWarning[];
  createdAt: Date;
}

export function resumeExtension(mimeType: string): "pdf" | "docx" | null {
  if (mimeType === RESUME_MIME_TYPES.pdf) return "pdf";
  if (mimeType === RESUME_MIME_TYPES.docx) return "docx";
  return null;
}
