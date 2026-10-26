// Creates the Super Admin account (the only account until sign-up ships). Idempotent.
// Jobs are NOT seeded: they come from real sources via `npm run ingest`.
import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { createDatabase } from "../src/client";
import { jobListings, jobs, sources, users } from "../src/schema";

// ENV_FILE lets the same script target production, e.g. ENV_FILE=../../.env.production.local
config({ path: process.env.ENV_FILE ?? "../../.env" });

export const OWNER_USER_ID = "dev-user";

const db = createDatabase(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!);

await db
  .insert(users)
  .values({ id: OWNER_USER_ID, name: "Super Admin" })
  .onConflictDoUpdate({ target: users.id, set: { name: "Super Admin" } });

// Remove the fictional sample jobs from earlier development builds, if present.
const [sample] = await db.select({ id: sources.id }).from(sources).where(eq(sources.key, "seed"));
if (sample) {
  const sampleJobs = db.select({ id: jobListings.jobId }).from(jobListings).where(eq(jobListings.sourceId, sample.id));
  await db.delete(jobs).where(inArray(jobs.id, sampleJobs));
  await db.delete(sources).where(eq(sources.id, sample.id));
  console.log("Removed sample jobs.");
}

console.log(`Super Admin account "${OWNER_USER_ID}" ready. Run \`npm run ingest\` to load real jobs.`);
await db.$client.end();
