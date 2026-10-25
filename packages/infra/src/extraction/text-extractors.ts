import { RESUME_MIME_TYPES, type TextExtractor } from "@ajh/core";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

/** Strategy: Word (.docx) → plain text. */
export class DocxTextExtractor implements TextExtractor {
  supports(mimeType: string): boolean {
    return mimeType === RESUME_MIME_TYPES.docx;
  }

  async extract(bytes: Uint8Array): Promise<string> {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value;
  }
}

/** Strategy: PDF → plain text. Scanned PDFs return little or no text; the parser then reads the PDF directly. */
export class PdfTextExtractor implements TextExtractor {
  supports(mimeType: string): boolean {
    return mimeType === RESUME_MIME_TYPES.pdf;
  }

  async extract(bytes: Uint8Array): Promise<string> {
    // unpdf may detach the buffer it is given, so hand it a copy.
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
}

export function defaultTextExtractors(): TextExtractor[] {
  return [new DocxTextExtractor(), new PdfTextExtractor()];
}
