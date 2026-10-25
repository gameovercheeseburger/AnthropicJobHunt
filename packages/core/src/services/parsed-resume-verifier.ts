import type { ParsedResume, VerificationField, VerificationWarning } from "../domain/resume";

/** Share of a bullet's words that must appear in the source text. */
const BULLET_COVERAGE = 0.85;

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/[^a-z0-9+#]+/g, " ") // keep C++, C#
    .trim();
}

/**
 * Truthfulness check on parser output: everything we import into the profile must be
 * traceable to the uploaded resume. Anything that isn't becomes a warning the user reviews,
 * so an AI mistake can never silently add an employer, title, degree, or skill.
 */
export class ParsedResumeVerifier {
  verify(parsed: ParsedResume, sourceText: string): VerificationWarning[] {
    const source = normalizeForMatch(sourceText);
    const sourceWords = new Set(source.split(" "));
    const warnings: VerificationWarning[] = [];

    const requirePhrase = (field: VerificationField, value: string | null) => {
      if (!value) return;
      const needle = normalizeForMatch(value);
      if (needle && !source.includes(needle)) {
        warnings.push({ field, value, message: `"${value}" was not found word-for-word in your resume.` });
      }
    };

    for (const exp of parsed.experiences) {
      requirePhrase("company", exp.company);
      requirePhrase("title", exp.title);
      for (const bullet of exp.bullets) {
        const words = normalizeForMatch(bullet.text)
          .split(" ")
          .filter((w) => w.length > 2);
        if (words.length === 0) continue;
        const covered = words.filter((w) => sourceWords.has(w)).length / words.length;
        if (covered < BULLET_COVERAGE) {
          warnings.push({
            field: "bullet",
            value: bullet.text,
            message: "This bullet differs from the wording in your resume.",
          });
        }
      }
    }
    for (const edu of parsed.education) {
      requirePhrase("school", edu.school);
      requirePhrase("degree", edu.degree);
    }
    for (const cert of parsed.certifications) requirePhrase("certification", cert.name);
    for (const skill of parsed.skills) requirePhrase("skill", skill);

    return warnings;
  }
}
