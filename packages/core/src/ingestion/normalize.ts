// Pure normalization helpers shared by every connector. Unit-tested; no I/O.
import type { EmploymentType, RemoteType, Seniority } from "../domain/job";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  bull: "•",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Turns job-description HTML (possibly entity-escaped, as Greenhouse sends it) into readable text. */
export function htmlToText(html: string): string {
  let s = html.includes("&lt;") ? decodeEntities(html) : html;
  s = s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|section)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(s)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A short card summary: the first substantial paragraph, cut at a word boundary. */
export function summarize(text: string, max = 280): string {
  const para =
    text
      .split(/\n+/)
      .map((p) => p.replace(/^•\s*/, "").trim())
      .find((p) => p.length >= 60) ?? text.trim();
  if (para.length <= max) return para;
  const cut = para.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).replace(/[,;:\s]+$/, "")}…`;
}

export const normalizeKey = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Company names compare equal across sources ("Stripe, Inc." = "Stripe"). */
export function normalizeCompanyName(name: string): string {
  return normalizeKey(name).replace(/\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|gmbh|plc|ulc)\b/g, "").trim();
}

/** Titles compare equal regardless of decoration ("Senior Engineer (Remote) - Toronto"). */
export function normalizeTitle(title: string): string {
  return normalizeKey(title.replace(/\((remote|hybrid|on[- ]?site|contract|temporary)[^)]*\)/gi, ""));
}

// ---- Location ---------------------------------------------------------------------------

const PROVINCES =
  "ontario|quebec|québec|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|yukon|nunavut|northwest territories";
// Unambiguous Canadian cities only ("London", "Victoria", "Hamilton" exist elsewhere too).
const CITIES =
  "toronto|vancouver|montr[eé]al|calgary|ottawa|edmonton|winnipeg|mississauga|oakville|markham|burnaby|saskatoon|kitchener|gatineau|brampton|waterloo, on|halifax, ns|victoria, bc|london, on|hamilton, on|qu[eé]bec city";
const CANADA_RE = new RegExp(
  `\\bcanada\\b|\\bcanadian\\b|\\b(${PROVINCES})\\b|\\b(${CITIES})\\b|,\\s*(on|bc|ab|qc|mb|sk|ns|nb|nl|pe|yt|nt|nu)\\b`,
  "i",
);

export function mentionsCanada(location: string | null | undefined): boolean {
  return Boolean(location) && CANADA_RE.test(location!);
}

/** "Toronto, Ontario - Canada; Remote - US" → the Canadian parts first, for display. */
export function preferCanadianLocations(locations: Array<string | null | undefined>): string | null {
  const unique = [...new Set(locations.map((l) => l?.trim()).filter((l): l is string => Boolean(l)))];
  if (unique.length === 0) return null;
  const canadian = unique.filter(mentionsCanada);
  return (canadian.length ? canadian : unique).join(" · ");
}

export function detectRemoteType(...texts: Array<string | null | undefined>): RemoteType {
  const s = texts.filter(Boolean).join(" ").toLowerCase();
  if (/\bhybrid\b/.test(s)) return "hybrid";
  if (/\bremote\b|work from home|\bwfh\b/.test(s)) return "remote";
  if (/\bon[- ]?site\b|\bin[- ]office\b/.test(s)) return "onsite";
  return "unknown";
}

export function detectEmploymentType(...texts: Array<string | null | undefined>): EmploymentType {
  const s = texts.filter(Boolean).join(" ").toLowerCase();
  if (/\bintern(ship)?\b|\bco-?op\b/.test(s)) return "internship";
  if (/\bpart[- ]?time\b/.test(s)) return "part_time";
  if (/\bcontract(or)?\b|\bfreelance\b/.test(s)) return "contract";
  if (/\btemporary\b|\bfixed[- ]term\b|\bseasonal\b/.test(s)) return "temporary";
  if (/\bfull[- ]?time\b|\bpermanent\b|\bfulltime\b/.test(s)) return "full_time";
  return "unknown";
}

export function detectSeniority(title: string): Seniority {
  const t = title.toLowerCase();
  if (/\b(intern|internship|co-?op|student)\b/.test(t)) return "intern";
  if (/\b(chief|vp|vice president|head of|director|svp|evp)\b/.test(t)) return "executive";
  if (/\b(staff|principal|lead|manager|architect|distinguished)\b/.test(t)) return "lead";
  if (/\b(senior|sr\.?)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?|entry[- ]level|new grad(uate)?|associate|graduate)\b/.test(t)) return "junior";
  if (/\b(intermediate|mid[- ]level|ii)\b/.test(t)) return "mid";
  return "unknown";
}

// ---- Skills -----------------------------------------------------------------------------

/** Skills we recognise in job text. Display spelling → match pattern. Extend freely. */
const SKILLS: Array<[string, RegExp]> = [
  ["TypeScript", /\btypescript\b/i],
  ["JavaScript", /\bjavascript\b/i],
  ["Python", /\bpython\b/i],
  ["Java", /\bjava\b(?!script)/i],
  ["Kotlin", /\bkotlin\b/i],
  ["Swift", /\bswift\b/i],
  ["Go", /\bgolang\b|\bgo\b(?= (?:language|programming|services|microservices))/i],
  ["Rust", /\brust\b/i],
  ["Ruby", /\bruby\b/i],
  ["Rails", /\brails\b/i],
  ["PHP", /\bphp\b/i],
  ["C#", /\bc#|\.net\b/i],
  ["C++", /\bc\+\+/i],
  ["Scala", /\bscala\b/i],
  ["SQL", /\bsql\b/i],
  ["React", /\breact(\.js)?\b(?! native)/i],
  ["React Native", /\breact native\b/i],
  ["Next.js", /\bnext\.js\b/i],
  ["Vue", /\bvue(\.js)?\b/i],
  ["Angular", /\bangular\b/i],
  ["Node.js", /\bnode(\.js)?\b/i],
  ["GraphQL", /\bgraphql\b/i],
  ["PostgreSQL", /\bpostgres(ql)?\b/i],
  ["MySQL", /\bmysql\b/i],
  ["MongoDB", /\bmongo(db)?\b/i],
  ["Redis", /\bredis\b/i],
  ["Kafka", /\bkafka\b/i],
  ["Spark", /\bspark\b/i],
  ["Snowflake", /\bsnowflake\b/i],
  ["dbt", /\bdbt\b/i],
  ["Airflow", /\bairflow\b/i],
  ["AWS", /\baws\b|amazon web services/i],
  ["GCP", /\bgcp\b|google cloud/i],
  ["Azure", /\bazure\b/i],
  ["Kubernetes", /\bkubernetes\b|\bk8s\b/i],
  ["Docker", /\bdocker\b/i],
  ["Terraform", /\bterraform\b/i],
  ["CI/CD", /\bci\/cd\b/i],
  ["Linux", /\blinux\b/i],
  ["Machine Learning", /\bmachine learning\b/i],
  ["PyTorch", /\bpytorch\b/i],
  ["TensorFlow", /\btensorflow\b/i],
  ["LLMs", /\bllms?\b|large language models?/i],
  ["Data Analysis", /\bdata analysis\b/i],
  ["Excel", /\bexcel\b/i],
  ["Tableau", /\btableau\b/i],
  ["Power BI", /\bpower ?bi\b/i],
  ["Salesforce", /\bsalesforce\b/i],
  ["Figma", /\bfigma\b/i],
  ["Product Management", /\bproduct management\b/i],
  ["Agile", /\bagile\b|\bscrum\b/i],
  ["Accounting", /\baccounting\b/i],
  ["Customer Success", /\bcustomer success\b/i],
  ["Sales", /\bquota\b|\bb2b sales\b|\bsales cycle/i],
];

export function extractSkills(text: string, limit = 8): string[] {
  return SKILLS.filter(([, re]) => re.test(text))
    .map(([name]) => name)
    .slice(0, limit);
}

/** Same job across sources → same fingerprint (company + title + primary city). */
export function jobFingerprint(job: { companyName: string; title: string; location: string | null }): string {
  const city = normalizeKey((job.location ?? "").split(/[,·;\-–]/)[0] ?? "");
  return `${normalizeCompanyName(job.companyName)}|${normalizeTitle(job.title)}|${city}`;
}
