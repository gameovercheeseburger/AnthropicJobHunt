import { RESUME_MIME_TYPES, ResumeParseError } from "@ajh/core";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { ClaudeResumeParser, type ResumeExtraction } from "../src";

const extraction: ResumeExtraction = {
  is_resume: true,
  full_name: "Jane Rivera",
  headline: "Software Engineer",
  summary: null,
  location: "Calgary, AB",
  email: null,
  phone: null,
  links: [],
  skills: ["TypeScript"],
  experiences: [
    {
      company: "Northwind",
      title: "Engineer",
      location: null,
      start_date: "2021-03",
      end_date: null,
      is_current: true,
      bullets: ["Shipped things."],
    },
  ],
  education: [],
  certifications: [{ name: "AWS CCP", issuer: null, date: null }],
};

function fakeClient(response: { stop_reason: string; parsed_output: ResumeExtraction | null }) {
  const parse = vi.fn().mockResolvedValue(response);
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
}

const longText = "Jane Rivera — Software Engineer. ".repeat(20);
const docx = { fileName: "r.docx", mimeType: RESUME_MIME_TYPES.docx, bytes: new Uint8Array([1]) };
const scannedPdf = { fileName: "r.pdf", mimeType: RESUME_MIME_TYPES.pdf, bytes: new Uint8Array([37, 80, 68, 70]) };

describe("ClaudeResumeParser", () => {
  it("maps structured output to the domain shape", async () => {
    const { client } = fakeClient({ stop_reason: "end_turn", parsed_output: extraction });
    const result = await new ClaudeResumeParser({ client }).parse({ text: longText, file: docx });
    expect(result.experiences[0]).toEqual({
      company: "Northwind",
      title: "Engineer",
      location: null,
      startDate: "2021-03",
      endDate: null,
      isCurrent: true,
      bullets: ["Shipped things."],
    });
    expect(result.fullName).toBe("Jane Rivera");
  });

  it("requests the current model with fallbacks and sends extracted text", async () => {
    const { client, parse } = fakeClient({ stop_reason: "end_turn", parsed_output: extraction });
    await new ClaudeResumeParser({ client }).parse({ text: longText, file: docx });
    const params = parse.mock.calls[0]![0];
    expect(params).toMatchObject({
      model: "claude-opus-5-5",
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01"],
    });
    expect(params.messages[0].content).toEqual([expect.objectContaining({ type: "text" })]);
  });

  it("sends the PDF itself when it has no extractable text", async () => {
    const { client, parse } = fakeClient({ stop_reason: "end_turn", parsed_output: extraction });
    await new ClaudeResumeParser({ client }).parse({ text: "", file: scannedPdf });
    expect(parse.mock.calls[0]![0].messages[0].content[0]).toMatchObject({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: "JVBERg==" },
    });
  });

  it.each([
    [{ stop_reason: "refusal", parsed_output: null }, "couldn't process"],
    [{ stop_reason: "max_tokens", parsed_output: null }, "too long"],
    [{ stop_reason: "end_turn", parsed_output: { ...extraction, is_resume: false } }, "doesn't look like a resume"],
  ])("turns %o into a user-safe ResumeParseError", async (response, message) => {
    const { client } = fakeClient(response);
    const err = await new ClaudeResumeParser({ client }).parse({ text: longText, file: docx }).catch((e) => e);
    expect(err).toBeInstanceOf(ResumeParseError);
    expect(err.message).toContain(message);
  });
});
