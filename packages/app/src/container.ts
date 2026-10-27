import { FeedService, GB, IngestionService, ResumeService, StorageQuotaService, SwipeService } from "@ajh/core";
import { createConnectorRegistry, DEFAULT_JSEARCH_SOURCE, DEFAULT_SOURCES } from "@ajh/connectors";
import { ClaudeResumeParser } from "@ajh/ai";
import {
  createDatabase,
  createRepositories,
  DrizzleIngestionRepository,
  DrizzleSourceRepository,
  DrizzleUnitOfWork,
} from "@ajh/db";
import { defaultTextExtractors, EncryptedFileStorage, FieldCipher, S3FileStorage } from "@ajh/infra";
import { loadConfig, type AppConfig } from "./config";

/**
 * Composition root: the only place concrete adapters are constructed and wired to services.
 * Shared by the web app, the background worker, and scripts.
 */
export function createContainer(config: AppConfig = loadConfig()) {
  const db = createDatabase(config.DATABASE_URL, { serverless: Boolean(process.env.VERCEL) });
  const cipher = new FieldCipher(config.DATA_ENCRYPTION_KEY);
  const repos = createRepositories(db, cipher);
  const uow = new DrizzleUnitOfWork(db, cipher);
  const storage = new EncryptedFileStorage(
    new S3FileStorage({
      endpoint: config.S3_ENDPOINT,
      region: config.S3_REGION,
      bucket: config.S3_BUCKET,
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    }),
    cipher,
  );

  const quota = new StorageQuotaService(storage, repos.resumes, { limitBytes: config.STORAGE_LIMIT_GB * GB });

  const sources = new DrizzleSourceRepository(db);
  const ingestion = new IngestionService({
    sources,
    ingestion: new DrizzleIngestionRepository(db),
    connectors: createConnectorRegistry({ jsearchApiKey: config.JSEARCH_API_KEY }),
  });

  return {
    feed: new FeedService(repos.jobs),
    swipes: new SwipeService(uow),
    resumes: new ResumeService({
      uow,
      repos,
      storage,
      extractors: defaultTextExtractors(),
      parser: new ClaudeResumeParser(), // reads ANTHROPIC_API_KEY from the environment
      quota,
    }),
    /** Storage cap: usage check and cleanup (also run by the daily cron). */
    storage: quota,
    /** Refreshes jobs from every enabled source (CLI and scheduled cron). */
    ingestion: {
      async runAll() {
        await sources.ensureDefaults([
          ...DEFAULT_SOURCES.map(({ key, name, kind, boards }) => ({ key, name, kind, config: { boards } })),
          // Only offered once a key is configured, so runs without a key stay error-free.
          ...(config.JSEARCH_API_KEY ? [{ ...DEFAULT_JSEARCH_SOURCE, config: { ...DEFAULT_JSEARCH_SOURCE.config } }] : []),
        ]);
        return ingestion.runAll();
      },
    },
    /** Closes the database pool (scripts and tests). */
    dispose: () => db.$client.end(),
  };
}

export type Container = ReturnType<typeof createContainer>;
