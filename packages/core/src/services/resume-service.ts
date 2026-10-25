import type { ProfileView } from "../domain/profile";
import {
  MAX_RESUME_BYTES,
  RESUME_MIME_TYPES,
  resumeExtension,
  type ExtractedResume,
  type ParsedResume,
  type ResumeFile,
  type VerificationWarning,
} from "../domain/resume";
import { DomainError, ValidationError } from "../errors";
import type { Repositories, UnitOfWork } from "../ports/repositories";
import type { FileStorage, ResumeParser, TextExtractor } from "../ports/resume";
import { ParsedResumeVerifier } from "./parsed-resume-verifier";

/** Thrown by parsers with a message that is safe to show the user. */
export class ResumeParseError extends DomainError {}

export type UploadResult =
  | { status: "parsed"; resumeId: string; warnings: VerificationWarning[] }
  | { status: "failed"; resumeId: string; error: string };

export interface ResumeServiceDeps {
  uow: UnitOfWork;
  repos: Pick<Repositories, "resumes" | "profiles">;
  storage: FileStorage;
  extractors: TextExtractor[];
  parser: ResumeParser;
  verifier?: ParsedResumeVerifier;
  newId?: () => string;
}

/** Below this, a PDF is probably scanned images; the parser then reads the PDF itself. */
const MIN_TEXT_CHARS = 200;

/** Service layer: master resume upload → extract → AI parse → verify → profile import. */
export class ResumeService {
  private readonly verifier: ParsedResumeVerifier;
  private readonly newId: () => string;

  constructor(private readonly deps: ResumeServiceDeps) {
    this.verifier = deps.verifier ?? new ParsedResumeVerifier();
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  async uploadMasterResume(userId: string, file: ResumeFile): Promise<UploadResult> {
    const ext = resumeExtension(file.mimeType);
    if (!ext) throw new ValidationError("Upload a PDF or Word (.docx) file.");
    if (file.bytes.byteLength === 0) throw new ValidationError("That file is empty.");
    if (file.bytes.byteLength > MAX_RESUME_BYTES) throw new ValidationError("Resumes must be 5 MB or smaller.");
    const extractor = this.deps.extractors.find((e) => e.supports(file.mimeType));
    if (!extractor) throw new ValidationError("That file type isn't supported yet.");

    const fileKey = `resumes/${userId}/${this.newId()}.${ext}`;
    await this.deps.storage.put(fileKey, file.bytes, file.mimeType);
    const record = await this.deps.repos.resumes.createMaster({
      userId,
      fileName: file.fileName,
      fileKey,
      mimeType: file.mimeType,
      sizeBytes: file.bytes.byteLength,
    });

    try {
      const text = (await extractor.extract(file.bytes)).trim();
      if (text.length < MIN_TEXT_CHARS && file.mimeType !== RESUME_MIME_TYPES.pdf) {
        throw new ResumeParseError("We couldn't find any text in that document.");
      }
      const parsed = this.withIds(normalizeExtracted(await this.deps.parser.parse({ text, file })));
      // Scanned PDFs have no extractable text, so there is nothing to verify against.
      const warnings = text.length >= MIN_TEXT_CHARS ? this.verifier.verify(parsed, text) : [];

      await this.deps.uow.run(async ({ resumes, profiles }) => {
        await resumes.markParsed(record.id, { rawText: text, parsed, warnings });
        await profiles.replaceFromResume(userId, parsed);
      });
      return { status: "parsed", resumeId: record.id, warnings };
    } catch (err) {
      const error =
        err instanceof DomainError ? err.message : "Something went wrong while reading your resume. Please try again.";
      await this.deps.repos.resumes.markFailed(record.id, error);
      if (!(err instanceof DomainError)) console.error("Resume parsing failed", err);
      return { status: "failed", resumeId: record.id, error };
    }
  }

  async getProfile(userId: string): Promise<ProfileView> {
    const [view, master, parsed] = await Promise.all([
      this.deps.repos.profiles.getView(userId),
      this.deps.repos.resumes.findMaster(userId),
      this.deps.repos.resumes.findMasterParsed(userId),
    ]);
    return {
      userId,
      fullName: parsed?.fullName ?? null,
      headline: view?.headline ?? null,
      summary: view?.summary ?? null,
      location: view?.location ?? null,
      links: view?.links ?? [],
      experiences: view?.experiences ?? [],
      education: view?.education ?? [],
      certifications: view?.certifications ?? [],
      skills: view?.skills ?? [],
      masterResume: master,
    };
  }

  private withIds(extracted: ExtractedResume): ParsedResume {
    return {
      ...extracted,
      experiences: extracted.experiences.map((exp) => ({
        ...exp,
        id: this.newId(),
        bullets: exp.bullets.map((text) => ({ id: this.newId(), text })),
      })),
    };
  }
}

const clean = (s: string | null | undefined): string | null => {
  const t = s?.replace(/\s+/g, " ").trim();
  return t ? t : null;
};

/** Trims whitespace, drops empty entries, and de-duplicates skills case-insensitively. */
export function normalizeExtracted(r: ExtractedResume): ExtractedResume {
  const seen = new Set<string>();
  const skills = r.skills
    .map((s) => clean(s))
    .filter((s): s is string => s !== null)
    .filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return {
    fullName: clean(r.fullName),
    headline: clean(r.headline),
    summary: clean(r.summary),
    location: clean(r.location),
    email: clean(r.email),
    phone: clean(r.phone),
    links: r.links.filter((l) => clean(l.url)).map((l) => ({ label: clean(l.label) ?? l.url, url: l.url.trim() })),
    skills,
    experiences: r.experiences
      .filter((e) => clean(e.company) && clean(e.title))
      .map((e) => ({
        ...e,
        company: clean(e.company)!,
        title: clean(e.title)!,
        location: clean(e.location),
        startDate: clean(e.startDate),
        endDate: e.isCurrent ? null : clean(e.endDate),
        bullets: e.bullets.map((b) => clean(b)).filter((b): b is string => b !== null),
      })),
    education: r.education
      .filter((e) => clean(e.school))
      .map((e) => ({
        school: clean(e.school)!,
        degree: clean(e.degree),
        field: clean(e.field),
        startDate: clean(e.startDate),
        endDate: clean(e.endDate),
      })),
    certifications: r.certifications
      .filter((c) => clean(c.name))
      .map((c) => ({ name: clean(c.name)!, issuer: clean(c.issuer), date: clean(c.date) })),
  };
}
