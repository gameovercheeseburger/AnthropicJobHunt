import type { ParsedResume, ProfileLink, ResumeRecord } from "./resume";

/** Read model for the profile page. */
export interface ProfileView {
  userId: string;
  fullName: string | null;
  headline: string | null;
  summary: string | null;
  location: string | null;
  links: ProfileLink[];
  experiences: ParsedResume["experiences"];
  education: ParsedResume["education"];
  certifications: ParsedResume["certifications"];
  skills: string[];
  masterResume: ResumeRecord | null;
}
