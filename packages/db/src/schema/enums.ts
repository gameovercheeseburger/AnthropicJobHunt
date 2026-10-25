// Postgres enums mirror the domain constants in @ajh/core so the two never drift.
import {
  APPLICATION_STATUSES,
  EMPLOYMENT_TYPES,
  REMOTE_TYPES,
  SENIORITIES,
  SWIPE_DIRECTIONS,
} from "@ajh/core";
import { pgEnum } from "drizzle-orm/pg-core";

export const remoteTypeEnum = pgEnum("remote_type", REMOTE_TYPES);
export const employmentTypeEnum = pgEnum("employment_type", EMPLOYMENT_TYPES);
export const seniorityEnum = pgEnum("seniority", SENIORITIES);
export const salaryPeriodEnum = pgEnum("salary_period", ["hour", "month", "year"]);
export const jobStatusEnum = pgEnum("job_status", ["active", "expired"]);
export const sourceKindEnum = pgEnum("source_kind", ["ats", "aggregator", "schema_org", "direct"]);
export const runStatusEnum = pgEnum("run_status", ["running", "succeeded", "failed"]);
export const parseStatusEnum = pgEnum("parse_status", ["pending", "parsing", "parsed", "failed"]);
export const swipeDirectionEnum = pgEnum("swipe_direction", SWIPE_DIRECTIONS);
export const applicationStatusEnum = pgEnum("application_status", APPLICATION_STATUSES);
