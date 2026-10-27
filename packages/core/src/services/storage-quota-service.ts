import { DomainError } from "../errors";
import type { FileStorage, ResumeRepository } from "../ports/resume";

export const GB = 1024 ** 3;

/** Upload refused because storage is full even after cleanup. The message is safe to show. */
export class StorageFullError extends DomainError {
  constructor() {
    super("Storage is full right now. Please try again later or contact the site admin.");
  }
}

export interface StorageQuotaOptions {
  /** Hard limit: stored bytes never exceed this. */
  limitBytes: number;
  /** Routine cleanup starts once usage passes this share of the limit... */
  highWaterRatio?: number;
  /** ...and frees space down to this share. */
  lowWaterRatio?: number;
  /** Files without a database record younger than this are left alone (an upload may be mid-flight). */
  orphanGraceMs?: number;
  now?: () => Date;
}

export interface CleanupReport {
  usageBeforeBytes: number;
  usageAfterBytes: number;
  limitBytes: number;
  deletedOrphans: number;
  deletedSuperseded: number;
}

/**
 * Domain service enforcing the storage cap (Cloudflare R2: 8 GB by default).
 * Cleanup order: orphaned files first, then replaced resumes oldest first.
 * A user's current resume is never deleted.
 */
export class StorageQuotaService {
  private readonly limit: number;
  private readonly high: number;
  private readonly low: number;
  private readonly graceMs: number;
  private readonly now: () => Date;

  constructor(
    private readonly storage: FileStorage,
    private readonly resumes: Pick<ResumeRepository, "allFileKeys" | "listSuperseded" | "delete">,
    options: StorageQuotaOptions,
  ) {
    if (!(options.limitBytes > 0)) throw new Error("Storage limit must be positive");
    this.limit = options.limitBytes;
    this.high = this.limit * (options.highWaterRatio ?? 0.9);
    this.low = this.limit * (options.lowWaterRatio ?? 0.8);
    this.graceMs = options.orphanGraceMs ?? 60 * 60 * 1000;
    this.now = options.now ?? (() => new Date());
  }

  async usageBytes(): Promise<number> {
    let total = 0;
    for await (const obj of this.storage.list()) total += obj.sizeBytes;
    return total;
  }

  /**
   * Hard stop: call before storing `incomingBytes`. Cleans up if needed; throws StorageFullError
   * if the file still wouldn't fit under the limit.
   */
  async ensureRoom(incomingBytes: number): Promise<void> {
    const usage = await this.usageBytes();
    if (usage + incomingBytes <= this.limit) return;
    const report = await this.freeUntil(Math.min(this.low, this.limit - incomingBytes), usage);
    if (report.usageAfterBytes + incomingBytes > this.limit) throw new StorageFullError();
  }

  /** Routine maintenance (daily cron): if usage is above the high-water mark, free down to the low-water mark. */
  async maintain(): Promise<CleanupReport> {
    const usage = await this.usageBytes();
    if (usage <= this.high) return this.report(usage, usage, 0, 0);
    return this.freeUntil(this.low, usage);
  }

  private async freeUntil(targetBytes: number, startBytes: number): Promise<CleanupReport> {
    let usage = startBytes;
    let deletedOrphans = 0;
    let deletedSuperseded = 0;

    // 1. Orphans: stored files the database no longer references.
    const known = await this.resumes.allFileKeys();
    const cutoff = this.now().getTime() - this.graceMs;
    const orphans: Array<{ key: string; sizeBytes: number; lastModified: Date }> = [];
    for await (const obj of this.storage.list()) {
      if (!known.has(obj.key) && obj.lastModified.getTime() < cutoff) orphans.push(obj);
    }
    orphans.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime());
    for (const obj of orphans) {
      if (usage <= targetBytes) break;
      await this.storage.delete(obj.key);
      usage -= obj.sizeBytes;
      deletedOrphans++;
    }

    // 2. Replaced resumes, oldest first. File first, then record, so a failure never leaves a dangling record.
    if (usage > targetBytes) {
      const sizes = new Map<string, number>();
      for await (const obj of this.storage.list()) sizes.set(obj.key, obj.sizeBytes);
      for (const old of await this.resumes.listSuperseded()) {
        if (usage <= targetBytes) break;
        await this.storage.delete(old.fileKey);
        await this.resumes.delete(old.id);
        usage -= sizes.get(old.fileKey) ?? 0;
        deletedSuperseded++;
      }
    }

    return this.report(startBytes, usage, deletedOrphans, deletedSuperseded);
  }

  private report(before: number, after: number, deletedOrphans: number, deletedSuperseded: number): CleanupReport {
    return { usageBeforeBytes: before, usageAfterBytes: after, limitBytes: this.limit, deletedOrphans, deletedSuperseded };
  }
}
