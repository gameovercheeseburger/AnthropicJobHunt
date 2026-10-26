// Refreshes jobs from every enabled source. Usage: npm run ingest
// (ENV_FILE=../../.env.production.local npm run ingest targets production.)
import path from "node:path";
import { config } from "dotenv";
import { createContainer } from "../src";

config({ path: process.env.ENV_FILE ? path.resolve(process.env.ENV_FILE) : path.resolve(import.meta.dirname, "../../../.env") });

const app = createContainer();
const started = Date.now();
try {
  const reports = await app.ingestion.runAll();
  for (const r of reports) {
    console.log(
      `${r.sourceKey.padEnd(11)} fetched ${r.fetched}, kept ${r.kept} in Canada → ${r.created} new, ${r.updated} updated, ${r.expired} expired` +
        (r.failedScopes ? `, ${r.failedScopes} board(s) failed` : ""),
    );
    for (const e of r.errors.slice(0, 5)) console.log(`    ! ${e}`);
  }
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
} finally {
  await app.dispose();
}
