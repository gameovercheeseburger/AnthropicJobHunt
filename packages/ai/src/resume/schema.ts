import type { ExtractedResume } from "@ajh/core";
import { z } from "zod";

/** Structured-output schema Claude must fill. snake_case reads naturally to the model. */
export const ResumeExtractionSchema = z.object({
  is_resume: z.boolean().describe("False if the document is not a resume or CV."),
  full_name: z.string().nullable(),
  headline: z.string().nullable().describe("The professional title the resume states for the person, verbatim."),
  summary: z.string().nullable().describe("The resume's own summary/profile paragraph, verbatim."),
  location: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  skills: z.array(z.string()),
  experiences: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      location: z.string().nullable(),
      start_date: z.string().nullable().describe('"YYYY-MM", or "YYYY" if no month is given.'),
      end_date: z.string().nullable().describe('"YYYY-MM" or "YYYY"; null if current.'),
      is_current: z.boolean(),
      bullets: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string().nullable(),
      field: z.string().nullable(),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
    }),
  ),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string().nullable(),
      date: z.string().nullable(),
    }),
  ),
});

export type ResumeExtraction = z.infer<typeof ResumeExtractionSchema>;

export function toExtractedResume(r: ResumeExtraction): ExtractedResume {
  return {
    fullName: r.full_name,
    headline: r.headline,
    summary: r.summary,
    location: r.location,
    email: r.email,
    phone: r.phone,
    links: r.links,
    skills: r.skills,
    experiences: r.experiences.map((e) => ({
      company: e.company,
      title: e.title,
      location: e.location,
      startDate: e.start_date,
      endDate: e.end_date,
      isCurrent: e.is_current,
      bullets: e.bullets,
    })),
    education: r.education.map((e) => ({
      school: e.school,
      degree: e.degree,
      field: e.field,
      startDate: e.start_date,
      endDate: e.end_date,
    })),
    certifications: r.certifications,
  };
}
