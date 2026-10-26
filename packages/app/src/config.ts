import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATA_ENCRYPTION_KEY: z.string().min(1, "DATA_ENCRYPTION_KEY is required (see .env.example)"),
  S3_ENDPOINT: z.string().optional().transform((v) => v || undefined),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1, "S3_BUCKET is required"),
  S3_ACCESS_KEY_ID: z.string().min(1, "S3_ACCESS_KEY_ID is required"),
  S3_SECRET_ACCESS_KEY: z.string().min(1, "S3_SECRET_ACCESS_KEY is required"),
  /** Optional: enables the JSearch (Google for Jobs) source. */
  JSEARCH_API_KEY: z.string().optional().transform((v) => v?.trim() || undefined),
});

export type AppConfig = z.infer<typeof EnvSchema>;

/** Validates environment variables once, with readable errors. Secrets come only from the environment. */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration. Check the .env file at the repo root:\n${problems}`);
  }
  return result.data;
}
