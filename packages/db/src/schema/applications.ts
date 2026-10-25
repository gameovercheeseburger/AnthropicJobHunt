// Swipes, applications (tracker), tailored resumes, cover letters, audit log.
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { applicationStatusEnum, swipeDirectionEnum } from "./enums";
import { jobs } from "./jobs";
import { resumes } from "./profiles";

export const jobSwipes = pgTable(
  "job_swipes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    direction: swipeDirectionEnum("direction").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.jobId] }),
    index("job_swipes_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const tailoredResumes = pgTable(
  "tailored_resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    masterResumeId: uuid("master_resume_id").references(() => resumes.id, { onDelete: "set null" }),
    contentJsonEnc: text("content_json_enc").notNull(),
    diffJson: jsonb("diff_json"),
    matchScore: real("match_score"),
    missingKeywords: jsonb("missing_keywords").$type<string[]>().notNull().default([]),
    gaps: jsonb("gaps").$type<string[]>().notNull().default([]),
    validatorReport: jsonb("validator_report"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    pdfKey: text("pdf_key"),
    docxKey: text("docx_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tailored_resumes_user_job_idx").on(t.userId, t.jobId)],
);

export const coverLetters = pgTable("cover_letters", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  contentEnc: text("content_enc").notNull(),
  validatorReport: jsonb("validator_report"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").notNull(),
    position: integer("position").notNull().default(0), // Kanban order within a column
    notes: text("notes"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    tailoredResumeId: uuid("tailored_resume_id").references(() => tailoredResumes.id, {
      onDelete: "set null",
    }),
    coverLetterId: uuid("cover_letter_id").references(() => coverLetters.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("applications_user_job_uq").on(t.userId, t.jobId),
    index("applications_user_status_idx").on(t.userId, t.status, t.position),
  ],
);

export const applicationEvents = pgTable(
  "application_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    fromStatus: applicationStatusEnum("from_status"),
    toStatus: applicationStatusEnum("to_status").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("application_events_app_idx").on(t.applicationId)],
);

/** Audit trail for privacy-relevant actions. user_id is kept as plain text so deletions stay auditable. */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
