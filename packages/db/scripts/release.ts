// Runs during `vercel-build`: applies migrations and ensures the Super Admin account exists,
// so production needs no manual database step. Preview deployments never touch the database.
import { config } from "dotenv";

// On Vercel the variables come from project settings; locally from .env (or ENV_FILE).
config({ path: process.env.ENV_FILE ?? "../../.env" });

const onVercel = Boolean(process.env.VERCEL);
const env = process.env.VERCEL_ENV;

if (onVercel && env !== "production") {
  console.log(`[release] ${env ?? "unknown"} deployment: skipping database migrations.`);
} else if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
  // Fail the build loudly: deploying without a database would give a broken site.
  console.error("[release] DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables.");
  process.exit(1);
} else {
  console.log("[release] Applying database migrations…");
  await import("./migrate");
  console.log("[release] Ensuring the Super Admin account…");
  await import("./seed");
}
