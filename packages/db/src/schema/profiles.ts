// Profile and resume data. Fields suffixed `_enc` hold AES-GCM ciphertext (see crypto.ts).
import type { VerificationWarning } from "@ajh/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { parseStatusEnum } from "./enums";

export const EMBEDDING_DIMENSIONS = 1024; // voyage-3.5

export type ProfileLink = { label: string; url: string };
export type ExperienceBullet = { id: string; text: string };

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  headline: text("headline"),
  summary: text("summary"),
  location: text("location"),
  links: jsonb("links").$type<ProfileLink[]>().notNull().default([]),
  // Reserved for the social phase.
  visibility: text("visibility").notNull().default("private"),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profileExperiences = pgTable(
  "profile_experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    startDate: text("start_date"), // "YYYY-MM"
    endDate: text("end_date"),
    isCurrent: boolean("is_current").notNull().default(false),
    // Bullets carry stable ids so tailored output can cite its source (no-fabrication rule).
    bullets: jsonb("bullets").$type<ExperienceBullet[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("profile_experiences_user_idx").on(t.userId)],
);

export const profileEducations = pgTable(
  "profile_educations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    school: text("school").notNull(),
    degree: text("degree"),
    field: text("field"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("profile_educations_user_idx").on(t.userId)],
);

export const profileSkills = pgTable(
  "profile_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("profile_skills_user_name_uq").on(t.userId, sql`lower(${t.name})`)],
);

export const profileCertifications = pgTable(
  "profile_certifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    issuer: text("issuer"),
    date: text("date"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("profile_certifications_user_idx").on(t.userId)],
);

export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isMaster: boolean("is_master").notNull().default(false),
    fileName: text("file_name").notNull(),
    fileKey: text("file_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    rawTextEnc: text("raw_text_enc"),
    parsedJsonEnc: text("parsed_json_enc"),
    parseStatus: parseStatusEnum("parse_status").notNull().default("pending"),
    parseError: text("parse_error"),
    // Values the truthfulness check could not find in the source resume.
    warnings: jsonb("warnings").$type<VerificationWarning[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resumes_user_idx").on(t.userId),
    // At most one master resume per user.
    uniqueIndex("resumes_one_master_uq").on(t.userId).where(sql`${t.isMaster}`),
  ],
);
