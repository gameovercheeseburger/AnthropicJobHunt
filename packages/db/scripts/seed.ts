// Local development seed: fictional Canadian companies and jobs so the swipe deck has content
// before the real source connectors exist. Idempotent: safe to run repeatedly.
import { config } from "dotenv";
import { createDatabase } from "../src/client";
import { inArray } from "drizzle-orm";
import { companies, jobListings, jobs, sources, users } from "../src/schema";

config({ path: "../../.env" });

export const DEV_USER_ID = "dev-user";

type SeedJob = {
  company: string;
  title: string;
  location: string;
  remoteType: "onsite" | "hybrid" | "remote";
  seniority: "junior" | "mid" | "senior" | "lead";
  salary?: [number, number];
  skills: string[];
  summary: string;
  daysAgo: number;
};

const SEED_JOBS: SeedJob[] = [
  { company: "Northwind Labs", title: "Senior Frontend Engineer", location: "Remote (Canada)", remoteType: "remote", salary: [150000, 180000], seniority: "senior", skills: ["React", "TypeScript", "Next.js", "Accessibility"], summary: "Own the design system and ship a fast, accessible customer dashboard used by thousands of teams.", daysAgo: 1 },
  { company: "Bluefin Analytics", title: "Full-Stack Engineer", location: "Toronto, ON", remoteType: "hybrid", salary: [110000, 135000], seniority: "mid", skills: ["Node.js", "PostgreSQL", "React", "AWS"], summary: "Build data pipelines and the product surfaces on top of them for a fast-growing analytics platform.", daysAgo: 2 },
  { company: "Cedar Health", title: "Backend Engineer, Platform", location: "Vancouver, BC", remoteType: "onsite", salary: [120000, 145000], seniority: "mid", skills: ["Go", "Kubernetes", "PostgreSQL", "gRPC"], summary: "Scale the core services behind a HIPAA-compliant patient scheduling platform.", daysAgo: 3 },
  { company: "Lumen Robotics", title: "Machine Learning Engineer", location: "Montréal, QC", remoteType: "hybrid", salary: [140000, 175000], seniority: "senior", skills: ["Python", "PyTorch", "Computer Vision", "MLOps"], summary: "Train and deploy perception models that run on warehouse robots in production.", daysAgo: 1 },
  { company: "Harbor Finance", title: "Junior Software Engineer", location: "Calgary, AB", remoteType: "hybrid", salary: [75000, 90000], seniority: "junior", skills: ["Java", "Spring", "SQL"], summary: "Join a mentoring-focused team building internal tools for a payments company.", daysAgo: 5 },
  { company: "Orbit Learning", title: "Product Designer", location: "Remote (Canada)", remoteType: "remote", seniority: "mid", skills: ["Figma", "User Research", "Design Systems"], summary: "Design learning experiences for students on mobile and web, from research to polished UI.", daysAgo: 4 },
  { company: "Summit Energy", title: "DevOps Engineer", location: "Edmonton, AB", remoteType: "onsite", salary: [105000, 125000], seniority: "mid", skills: ["Terraform", "AWS", "CI/CD", "Linux"], summary: "Automate infrastructure for a renewable energy monitoring platform.", daysAgo: 6 },
  { company: "Pixel Forge", title: "Mobile Engineer (React Native)", location: "Waterloo, ON", remoteType: "remote", salary: [135000, 160000], seniority: "senior", skills: ["React Native", "TypeScript", "iOS", "Android"], summary: "Lead development of a top-rated creative app with millions of installs.", daysAgo: 2 },
  { company: "Quill Legal", title: "Engineering Manager", location: "Ottawa, ON", remoteType: "hybrid", salary: [160000, 190000], seniority: "lead", skills: ["Leadership", "Hiring", "TypeScript", "System Design"], summary: "Lead a team of eight engineers building AI-assisted document review tools.", daysAgo: 7 },
  { company: "Tidewater Logistics", title: "Data Engineer", location: "Halifax, NS", remoteType: "hybrid", salary: [100000, 120000], seniority: "mid", skills: ["Python", "dbt", "Snowflake", "Airflow"], summary: "Model shipping data and build the warehouse that powers routing decisions.", daysAgo: 3 },
];

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const db = createDatabase(process.env.DATABASE_URL!);

await db
  .insert(users)
  .values({ id: DEV_USER_ID, name: "Dev User", email: "dev@localhost" })
  .onConflictDoNothing();

const [source] = await db
  .insert(sources)
  .values({ key: "seed", name: "Local seed data", kind: "direct" })
  .onConflictDoUpdate({ target: sources.key, set: { name: "Local seed data" } })
  .returning();

// Replace previous seed jobs so edits to SEED_JOBS take effect (swipes on them cascade away).
const oldSeedJobs = db.select({ id: jobListings.jobId }).from(jobListings).where(inArray(jobListings.sourceId, [source!.id]));
await db.delete(jobs).where(inArray(jobs.id, oldSeedJobs));

for (const j of SEED_JOBS) {
  const [company] = await db
    .insert(companies)
    .values({ name: j.company, normalizedName: normalize(j.company) })
    .onConflictDoUpdate({ target: companies.normalizedName, set: { name: j.company } })
    .returning();

  const fingerprint = `${normalize(j.company)}|${normalize(j.title)}|${normalize(j.location)}`;
  const [job] = await db
    .insert(jobs)
    .values({
      companyId: company!.id,
      title: j.title,
      normalizedTitle: normalize(j.title),
      summary: j.summary,
      descriptionText: `${j.summary}\n\nSkills: ${j.skills.join(", ")}`,
      skills: j.skills,
      location: j.location,
      remoteType: j.remoteType,
      employmentType: "full_time",
      seniority: j.seniority,
      salaryMin: j.salary?.[0],
      salaryMax: j.salary?.[1],
      salaryCurrency: j.salary ? "CAD" : null,
      salaryPeriod: j.salary ? "year" : null,
      postedAt: new Date(Date.now() - j.daysAgo * 86_400_000),
      dedupFingerprint: fingerprint,
    })
    .onConflictDoUpdate({ target: jobs.dedupFingerprint, set: { summary: j.summary } })
    .returning();

  await db
    .insert(jobListings)
    .values({
      jobId: job!.id,
      sourceId: source!.id,
      externalId: fingerprint,
      applyUrl: `https://example.com/careers/${encodeURIComponent(normalize(j.company).replace(/ /g, "-"))}`,
    })
    .onConflictDoNothing();
}

console.log(`Seeded ${SEED_JOBS.length} jobs and dev user "${DEV_USER_ID}".`);
await db.$client.end();
