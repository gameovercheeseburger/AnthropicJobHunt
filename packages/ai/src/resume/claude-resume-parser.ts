import { RESUME_MIME_TYPES, ResumeParseError, type ExtractedResume, type ResumeFile, type ResumeParser } from "@ajh/core";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ResumeExtractionSchema, toExtractedResume } from "./schema";

export const RESUME_PARSER_MODEL = "claude-opus-5-5";

/** Below this much extracted text we send the PDF itself (likely a scanned document). */
const MIN_TEXT_CHARS = 200;

export const RESUME_PARSER_SYSTEM_PROMPT = `You convert a resume into structured data for a job-search app. The user will review the result, and a later step tailors their resume for job applications, so faithfulness to the source matters more than polish.

Copy, don't write. Every company, job title, school, degree, certification, skill, and bullet must come from the resume itself, using its wording. Do not rephrase, summarize, merge, or "improve" bullets; copy each one verbatim, without the leading bullet symbol. Do not infer skills from job duties: list a skill only if the resume names it. If something is missing or unclear, use null or an empty list rather than guessing.

Dates: use "YYYY-MM" when a month is given and "YYYY" otherwise. For a role marked "Present" or "Current", set is_current to true and end_date to null.

Headline is the professional title the resume states at the top; if there is none, use null. Summary is the resume's own summary or profile paragraph, verbatim.

If the document is not a resume or CV, set is_resume to false and leave every other field empty.`;

export interface ClaudeResumeParserOptions {
  client?: Anthropic;
  model?: string;
}

/** Adapter: ResumeParser backed by Claude structured outputs. */
export class ClaudeResumeParser implements ResumeParser {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: ClaudeResumeParserOptions = {}) {
    this.client = options.client ?? new Anthropic();
    this.model = options.model ?? RESUME_PARSER_MODEL;
  }

  async parse({ text, file }: { text: string; file: ResumeFile }): Promise<ExtractedResume> {
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(ResumeExtractionSchema) },
      system: RESUME_PARSER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildContent(text, file) }],
    });

    if (response.stop_reason === "refusal") {
      throw new ResumeParseError("We couldn't process this document. Please upload a standard resume.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new ResumeParseError("This resume is too long to read in one pass. Try a shorter version.");
    }
    const result = response.parsed_output;
    if (!result) throw new Error(`Resume parser returned no structured output (stop_reason=${response.stop_reason})`);
    if (!result.is_resume) {
      throw new ResumeParseError("This doesn't look like a resume. Please upload your resume or CV.");
    }
    return toExtractedResume(result);
  }
}

function buildContent(text: string, file: ResumeFile): Anthropic.Beta.BetaContentBlockParam[] {
  if (text.length < MIN_TEXT_CHARS && file.mimeType === RESUME_MIME_TYPES.pdf) {
    return [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: Buffer.from(file.bytes).toString("base64") },
      },
      { type: "text", text: "Extract the structured data from this resume." },
    ];
  }
  return [{ type: "text", text: `<resume>\n${text}\n</resume>\n\nExtract the structured data from this resume.` }];
}
