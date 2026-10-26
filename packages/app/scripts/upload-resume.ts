// Uploads a resume for the local dev user through the same ResumeService the web app uses.
// Usage: npm run resume:upload -- <path-to-resume.pdf|docx>
// Prints a summary only (counts and warnings), not personal details.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { RESUME_MIME_TYPES } from "@ajh/core";
import { config } from "dotenv";
import { createContainer } from "../src";

config({ path: path.resolve(import.meta.dirname, "../../../.env") });

const file = process.argv[2];
if (!file) throw new Error("Usage: npm run resume:upload -- <path-to-resume.pdf|docx>");
if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is empty in the root .env file.");

const mimeType = file.toLowerCase().endsWith(".pdf") ? RESUME_MIME_TYPES.pdf : RESUME_MIME_TYPES.docx;
const app = createContainer();
const started = Date.now();

try {
  const result = await app.resumes.uploadMasterResume("dev-user", {
    fileName: path.basename(file),
    mimeType,
    bytes: new Uint8Array(await readFile(file)),
  });
  console.log(`Status: ${result.status} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  if (result.status === "failed") {
    console.log(`Error: ${result.error}`);
  } else {
    const p = await app.resumes.getProfile("dev-user");
    console.log(
      `Imported: ${p.experiences.length} roles, ${p.experiences.reduce((n, e) => n + e.bullets.length, 0)} bullets, ` +
        `${p.skills.length} skills, ${p.education.length} education, ${p.certifications.length} certifications`,
    );
    console.log(`Warnings: ${result.warnings.length}`);
    for (const w of result.warnings) console.log(`  - ${w.field}: ${w.message}`);
  }
} finally {
  await app.dispose();
}
