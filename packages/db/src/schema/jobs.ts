// Companies, sources, and the deduplicated job catalog.
import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  customType,
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
import {
  employmentTypeEnum,
  jobStatusEnum,
  remoteTypeEnum,
  runStatusEnum,
  salaryPeriodEnum,
  seniorityEnum,
  sourceKindEnum,
} from "./enums";
import { EMBEDDING_DIMENSIONS } from "./profiles";

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull().unique(),
  domain: text("domain"),
  logoUrl: text("logo_url"),
  atsType: text("ats_type"),
  atsBoardToken: text("ats_board_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(), // connector registry key, e.g. "greenhouse"
  name: text("name").notNull(),
  kind: sourceKindEnum("kind").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  rateLimitPerMin: integer("rate_limit_per_min").notNull().default(60),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
});

export const sourceRuns = pgTable(
  "source_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    status: runStatusEnum("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    fetched: integer("fetched").notNull().default(0),
    created: integer("created").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    expired: integer("expired").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("source_runs_source_idx").on(t.sourceId, t.startedAt)],
);

/** One row per real-world job after deduplication across sources. */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    descriptionHtml: text("description_html"),
    descriptionText: text("description_text").notNull().default(""),
    summary: text("summary").notNull().default(""),
    skills: jsonb("skills").$type<string[]>().notNull().default([]),
    location: text("location"),
    country: text("country"),
    remoteType: remoteTypeEnum("remote_type").notNull().default("unknown"),
    employmentType: employmentTypeEnum("employment_type").notNull().default("unknown"),
    seniority: seniorityEnum("seniority").notNull().default("unknown"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: text("salary_currency"),
    salaryPeriod: salaryPeriodEnum("salary_period"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    status: jobStatusEnum("status").notNull().default("active"),
    dedupFingerprint: text("dedup_fingerprint").notNull(),
    searchTsv: tsvector("search_tsv").generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', coalesce(${jobs.title}, '')), 'A') || setweight(to_tsvector('english', coalesce(${jobs.descriptionText}, '')), 'C')`,
    ),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("jobs_dedup_fingerprint_uq").on(t.dedupFingerprint),
    index("jobs_status_posted_idx").on(t.status, t.postedAt),
    index("jobs_search_tsv_idx").using("gin", t.searchTsv),
    index("jobs_title_trgm_idx").using("gin", sql`${t.normalizedTitle} gin_trgm_ops`),
    index("jobs_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

/** The raw listing as seen in each source; many listings can map to one job. */
export const jobListings = pgTable(
  "job_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    applyUrl: text("apply_url").notNull(),
    rawJson: jsonb("raw_json"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("job_listings_source_external_uq").on(t.sourceId, t.externalId),
    index("job_listings_job_idx").on(t.jobId),
  ],
);
