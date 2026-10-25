import type { ParsedResume, ResumeRecord, ResumeRepository, VerificationWarning } from "@ajh/core";
import type { FieldCipher } from "@ajh/infra";
import { and, eq } from "drizzle-orm";
import type { Executor } from "../client";
import { resumes } from "../schema";

const recordColumns = {
  id: resumes.id,
  userId: resumes.userId,
  isMaster: resumes.isMaster,
  fileName: resumes.fileName,
  mimeType: resumes.mimeType,
  sizeBytes: resumes.sizeBytes,
  parseStatus: resumes.parseStatus,
  parseError: resumes.parseError,
  warnings: resumes.warnings,
  createdAt: resumes.createdAt,
};

/** Resume text and parsed JSON are encrypted here, so nothing above this layer handles ciphertext. */
export class DrizzleResumeRepository implements ResumeRepository {
  constructor(
    private readonly db: Executor,
    private readonly cipher: FieldCipher,
  ) {}

  createMaster(input: Parameters<ResumeRepository["createMaster"]>[0]): Promise<ResumeRecord> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(resumes)
        .set({ isMaster: false })
        .where(and(eq(resumes.userId, input.userId), eq(resumes.isMaster, true)));
      const [row] = await tx
        .insert(resumes)
        .values({ ...input, isMaster: true, parseStatus: "parsing" })
        .returning(recordColumns);
      return row!;
    });
  }

  async markParsed(
    id: string,
    input: { rawText: string; parsed: ParsedResume; warnings: VerificationWarning[] },
  ): Promise<void> {
    await this.db
      .update(resumes)
      .set({
        parseStatus: "parsed",
        parseError: null,
        rawTextEnc: this.cipher.encrypt(input.rawText),
        parsedJsonEnc: this.cipher.encrypt(JSON.stringify(input.parsed)),
        warnings: input.warnings,
      })
      .where(eq(resumes.id, id));
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.db.update(resumes).set({ parseStatus: "failed", parseError: error }).where(eq(resumes.id, id));
  }

  async findMaster(userId: string): Promise<ResumeRecord | null> {
    const [row] = await this.db
      .select(recordColumns)
      .from(resumes)
      .where(and(eq(resumes.userId, userId), eq(resumes.isMaster, true)))
      .limit(1);
    return row ?? null;
  }

  async findMasterParsed(userId: string): Promise<ParsedResume | null> {
    const [row] = await this.db
      .select({ parsedJsonEnc: resumes.parsedJsonEnc })
      .from(resumes)
      .where(and(eq(resumes.userId, userId), eq(resumes.isMaster, true)))
      .limit(1);
    return row?.parsedJsonEnc ? (JSON.parse(this.cipher.decrypt(row.parsedJsonEnc)) as ParsedResume) : null;
  }
}
