// Shows file-storage usage against the cap and runs routine cleanup. Usage: npm run storage:check
import path from "node:path";
import { config } from "dotenv";
import { GB, StorageFullError } from "@ajh/core";
import { createContainer } from "../src";

config({ path: process.env.ENV_FILE ? path.resolve(process.env.ENV_FILE) : path.resolve(import.meta.dirname, "../../../.env") });

const app = createContainer();
const limitGb = Number(process.env.STORAGE_LIMIT_GB ?? 8);
try {
  const used = await app.storage.usageBytes();
  console.log(`Storage used: ${(used / GB).toFixed(4)} GB of ${limitGb} GB (${((used / (limitGb * GB)) * 100).toFixed(2)}%)`);
  const report = await app.storage.maintain();
  console.log(`Maintenance: removed ${report.deletedOrphans} orphaned and ${report.deletedSuperseded} replaced file(s)`);
  if (process.argv.includes("--probe-limit")) {
    try {
      await app.storage.ensureRoom(limitGb * GB + 1);
      console.log("Probe: UNEXPECTED, an over-limit file was accepted");
      process.exitCode = 1;
    } catch (err) {
      console.log(err instanceof StorageFullError ? "Probe: over-limit file refused (hard stop works)" : `Probe error: ${err}`);
    }
  }
} finally {
  await app.dispose();
}
