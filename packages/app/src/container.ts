import { FeedService, ResumeService, SwipeService } from "@ajh/core";
import { ClaudeResumeParser } from "@ajh/ai";
import { createDatabase, createRepositories, DrizzleUnitOfWork } from "@ajh/db";
import { defaultTextExtractors, EncryptedFileStorage, FieldCipher, S3FileStorage } from "@ajh/infra";
import { loadConfig, type AppConfig } from "./config";

/**
 * Composition root: the only place concrete adapters are constructed and wired to services.
 * Shared by the web app, the background worker, and scripts.
 */
export function createContainer(config: AppConfig = loadConfig()) {
  const db = createDatabase(config.DATABASE_URL);
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

  return {
    feed: new FeedService(repos.jobs),
    swipes: new SwipeService(uow),
    resumes: new ResumeService({
      uow,
      repos,
      storage,
      extractors: defaultTextExtractors(),
      parser: new ClaudeResumeParser(), // reads ANTHROPIC_API_KEY from the environment
    }),
    /** Closes the database pool (scripts and tests). */
    dispose: () => db.$client.end(),
  };
}

export type Container = ReturnType<typeof createContainer>;
