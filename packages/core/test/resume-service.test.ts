import { beforeEach, describe, expect, it } from "vitest";
import {
  ParsedResumeVerifier,
  RESUME_MIME_TYPES,
  ResumeParseError,
  ResumeService,
  ValidationError,
  normalizeExtracted,
  type ExtractedResume,
  type ParsedResume,
  type ResumeParser,
  type TextExtractor,
} from "../src";
import { FakeFileStorage, InMemoryStore, fakeRepositories, fakeUnitOfWork } from "./fakes";

const USER = "user-1";

const SOURCE_TEXT = `Jane Rivera — Senior Software Engineer
Calgary, AB
SKILLS: TypeScript, React, PostgreSQL, AWS
EXPERIENCE
Northwind Labs — Senior Software Engineer (2021-03 – Present)
• Led the migration of the billing service to TypeScript, cutting incidents by 40%.
• Mentored four junior engineers through weekly code reviews.
Bluefin Analytics — Software Developer (2018-06 – 2021-02)
• Built React dashboards used by 2,000 customers.
EDUCATION
Southern Alberta Institute of Technology — Diploma, Software Development
CERTIFICATIONS
AWS Certified Cloud Practitioner`;

function extracted(overrides: Partial<ExtractedResume> = {}): ExtractedResume {
  return {
    fullName: "Jane Rivera",
    headline: "Senior Software Engineer",
    summary: null,
    location: "Calgary, AB",
    email: null,
    phone: null,
    links: [],
    skills: ["TypeScript", "React", "typescript", "PostgreSQL", "AWS"],
    experiences: [
      {
        company: "Northwind Labs",
        title: "Senior Software Engineer",
        location: null,
        startDate: "2021-03",
        endDate: null,
        isCurrent: true,
        bullets: [
          "Led the migration of the billing service to TypeScript, cutting incidents by 40%.",
          "  Mentored four junior engineers through weekly code reviews. ",
          "",
        ],
      },
      {
        company: "Bluefin Analytics",
        title: "Software Developer",
        location: null,
        startDate: "2018-06",
        endDate: "2021-02",
        isCurrent: false,
        bullets: ["Built React dashboards used by 2,000 customers."],
      },
    ],
    education: [
      {
        school: "Southern Alberta Institute of Technology",
        degree: "Diploma",
        field: "Software Development",
        startDate: null,
        endDate: null,
      },
    ],
    certifications: [{ name: "AWS Certified Cloud Practitioner", issuer: null, date: null }],
    ...overrides,
  };
}

const textExtractor = (text: string): TextExtractor => ({
  supports: (mime) => mime === RESUME_MIME_TYPES.docx || mime === RESUME_MIME_TYPES.pdf,
  extract: async () => text,
});

const parserReturning = (result: ExtractedResume | Error): ResumeParser => ({
  parse: async () => {
    if (result instanceof Error) throw result;
    return result;
  },
});

const docx = (bytes = 10) => ({
  fileName: "resume.docx",
  mimeType: RESUME_MIME_TYPES.docx,
  bytes: new Uint8Array(bytes),
});

describe("ResumeService.uploadMasterResume", () => {
  let store: InMemoryStore;
  let storage: FakeFileStorage;
  let ids: number;

  const service = (parser: ResumeParser, text = SOURCE_TEXT) =>
    new ResumeService({
      uow: fakeUnitOfWork(store),
      repos: fakeRepositories(store),
      storage,
      extractors: [textExtractor(text)],
      parser,
      newId: () => `id-${++ids}`,
    });

  beforeEach(() => {
    store = new InMemoryStore();
    storage = new FakeFileStorage();
    ids = 0;
  });

  it("stores the file, parses it, and imports the profile", async () => {
    const result = await service(parserReturning(extracted())).uploadMasterResume(USER, docx());

    expect(result.status).toBe("parsed");
    expect([...storage.files.keys()]).toEqual(["resumes/user-1/id-1.docx"]);
    expect(store.resumes[0]).toMatchObject({ parseStatus: "parsed", isMaster: true });

    const profile = await service(parserReturning(extracted())).getProfile(USER);
    expect(profile.headline).toBe("Senior Software Engineer");
    expect(profile.skills).toEqual(["TypeScript", "React", "PostgreSQL", "AWS"]);
    expect(profile.experiences[0]!.bullets.map((b) => b.text)).toEqual([
      "Led the migration of the billing service to TypeScript, cutting incidents by 40%.",
      "Mentored four junior engineers through weekly code reviews.",
    ]);
    expect(profile.masterResume?.parseStatus).toBe("parsed");
  });

  it("gives every experience and bullet a unique id", async () => {
    await service(parserReturning(extracted())).uploadMasterResume(USER, docx());
    const parsed = store.resumes[0]!.parsed!;
    const all = parsed.experiences.flatMap((e) => [e.id, ...e.bullets.map((b) => b.id)]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("returns no warnings when everything is traceable to the resume", async () => {
    const result = await service(parserReturning(extracted())).uploadMasterResume(USER, docx());
    expect(result).toMatchObject({ status: "parsed", warnings: [] });
  });

  it("flags invented employers, skills, and reworded bullets instead of trusting them", async () => {
    const fabricated = extracted({ skills: ["TypeScript", "Kubernetes"] });
    fabricated.experiences[0]!.company = "Google";
    fabricated.experiences[1]!.bullets = ["Architected a planet-scale distributed consensus platform."];

    const result = await service(parserReturning(fabricated)).uploadMasterResume(USER, docx());
    if (result.status !== "parsed") throw new Error("expected parsed");
    expect(result.warnings.map((w) => [w.field, w.value])).toEqual([
      ["company", "Google"],
      ["bullet", "Architected a planet-scale distributed consensus platform."],
      ["skill", "Kubernetes"],
    ]);
  });

  it("a newer upload replaces the master resume", async () => {
    await service(parserReturning(extracted())).uploadMasterResume(USER, docx());
    await service(parserReturning(extracted())).uploadMasterResume(USER, docx());
    expect(store.resumes.map((r) => r.isMaster)).toEqual([false, true]);
  });

  it("marks the resume failed with a safe message when parsing fails", async () => {
    const result = await service(parserReturning(new ResumeParseError("This doesn't look like a resume."))).uploadMasterResume(
      USER,
      docx(),
    );
    expect(result).toMatchObject({ status: "failed", error: "This doesn't look like a resume." });
    expect(store.resumes[0]).toMatchObject({ parseStatus: "failed" });
    expect(store.profiles.size).toBe(0);
  });

  it("hides unexpected internal errors from the user", async () => {
    const result = await service(parserReturning(new Error("socket hang up"))).uploadMasterResume(USER, docx());
    expect(result.status === "failed" && result.error).not.toContain("socket");
  });

  it("rejects a Word file with no text", async () => {
    const result = await service(parserReturning(extracted()), "   ").uploadMasterResume(USER, docx());
    expect(result).toMatchObject({ status: "failed", error: "We couldn't find any text in that document." });
  });

  it.each([
    [{ ...docx(), mimeType: "image/png" }, "PDF or Word"],
    [docx(0), "empty"],
    [docx(5 * 1024 * 1024 + 1), "5 MB"],
  ])("validates the upload (%#)", async (file, message) => {
    await expect(service(parserReturning(extracted())).uploadMasterResume(USER, file)).rejects.toThrow(
      expect.objectContaining({ constructor: ValidationError, message: expect.stringContaining(message) }),
    );
    expect(storage.files.size).toBe(0);
  });
});

describe("normalizeExtracted", () => {
  it("drops the end date of a current role and empty entries", () => {
    const r = normalizeExtracted(
      extracted({
        experiences: [
          { company: "A", title: "B", location: " ", startDate: "2020", endDate: "2024", isCurrent: true, bullets: [] },
          { company: " ", title: "B", location: null, startDate: null, endDate: null, isCurrent: false, bullets: [] },
        ],
      }),
    );
    expect(r.experiences).toEqual([
      { company: "A", title: "B", location: null, startDate: "2020", endDate: null, isCurrent: true, bullets: [] },
    ]);
  });
});

describe("ParsedResumeVerifier", () => {
  const verifier = new ParsedResumeVerifier();
  const base: ParsedResume = { ...extracted(), experiences: [] };

  it("tolerates punctuation, case, and smart-quote differences", () => {
    const warnings = verifier.verify(
      { ...base, skills: ["c++", "Node.js"], education: [], certifications: [] },
      "Skills: C++ · node js",
    );
    expect(warnings).toEqual([]);
  });

  it("flags a degree the resume never mentions", () => {
    const warnings = verifier.verify(
      { ...base, skills: [], certifications: [], education: [{ school: "SAIT", degree: "PhD", field: null, startDate: null, endDate: null }] },
      "SAIT Diploma",
    );
    expect(warnings).toEqual([expect.objectContaining({ field: "degree", value: "PhD" })]);
  });
});
