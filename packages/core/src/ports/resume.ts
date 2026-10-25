// Ports for the resume pipeline. Adapters: @ajh/infra (extraction, storage), @ajh/ai (parser), @ajh/db (repositories).
import type { ProfileView } from "../domain/profile";
import type {
  ExtractedResume,
  ParsedResume,
  ResumeFile,
  ResumeRecord,
  VerificationWarning,
} from "../domain/resume";

/** Strategy: one extractor per file format, chosen by mime type. */
export interface TextExtractor {
  supports(mimeType: string): boolean;
  extract(bytes: Uint8Array): Promise<string>;
}

/** Strategy: turns resume text (and the original file, for scanned PDFs) into structured data. */
export interface ResumeParser {
  parse(input: { text: string; file: ResumeFile }): Promise<ExtractedResume>;
}

export interface FileStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

export interface ResumeRepository {
  /** Creates the resume as the user's master, demoting any previous master. */
  createMaster(input: {
    userId: string;
    fileName: string;
    fileKey: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<ResumeRecord>;
  markParsed(id: string, input: { rawText: string; parsed: ParsedResume; warnings: VerificationWarning[] }): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  findMaster(userId: string): Promise<ResumeRecord | null>;
  /** Decrypted structured data of the master resume, if parsed. */
  findMasterParsed(userId: string): Promise<ParsedResume | null>;
}

export interface ProfileRepository {
  /** Replaces the user's profile sections with what was parsed from their resume. */
  replaceFromResume(userId: string, parsed: ParsedResume): Promise<void>;
  getView(userId: string): Promise<Omit<ProfileView, "masterResume" | "fullName"> | null>;
}
