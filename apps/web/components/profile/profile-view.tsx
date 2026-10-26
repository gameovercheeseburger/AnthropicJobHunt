import type { ProfileView as Profile, VerificationWarning } from "@ajh/core";
import { AlertTriangle, ExternalLink, MapPin } from "lucide-react";
import type { ReactNode } from "react";

/** Formats "YYYY-MM" / "YYYY" ranges, e.g. "Mar 2021 – Present". */
export function formatDateRange(start: string | null, end: string | null, isCurrent = false): string | null {
  const fmt = (d: string | null) => {
    if (!d) return null;
    const [y, m] = d.split("-");
    if (!m) return y ?? null;
    const month = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString("en-CA", {
      month: "short",
      timeZone: "UTC",
    });
    return `${month} ${y}`;
  };
  const from = fmt(start);
  const to = isCurrent ? "Present" : fmt(end);
  if (from && to) return `${from} – ${to}`;
  return from ?? to;
}

export function ProfileView({ profile }: { profile: Profile }) {
  const warnings = profile.masterResume?.warnings ?? [];
  const flagged = new Set(warnings.map((w) => w.value));

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">{profile.fullName ?? "Your profile"}</h2>
        {profile.headline && <p className="text-lg text-muted">{profile.headline}</p>}
        {profile.location && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <MapPin aria-hidden className="size-4" /> {profile.location}
          </p>
        )}
        {profile.links.length > 0 && (
          <ul className="flex flex-wrap gap-3 pt-1 text-sm">
            {profile.links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url.startsWith("http") ? l.url : `https://${l.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-brand underline-offset-4 hover:underline"
                >
                  {l.label} <ExternalLink aria-hidden className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </header>

      {warnings.length > 0 && <WarningsPanel warnings={warnings} />}

      {profile.summary && (
        <Section title="Summary">
          <p className="leading-relaxed">{profile.summary}</p>
        </Section>
      )}

      {profile.experiences.length > 0 && (
        <Section title="Experience">
          <ol className="space-y-5">
            {profile.experiences.map((exp) => (
              <li key={exp.id}>
                <h4 className="font-semibold">
                  <Flag on={flagged.has(exp.title)}>{exp.title}</Flag>
                </h4>
                <p className="text-sm text-muted">
                  <Flag on={flagged.has(exp.company)}>{exp.company}</Flag>
                  {exp.location && ` · ${exp.location}`}
                  {formatDateRange(exp.startDate, exp.endDate, exp.isCurrent) &&
                    ` · ${formatDateRange(exp.startDate, exp.endDate, exp.isCurrent)}`}
                </p>
                {exp.bullets.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed marker:text-muted">
                    {exp.bullets.map((b) => (
                      <li key={b.id}>
                        <Flag on={flagged.has(b.text)}>{b.text}</Flag>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {profile.skills.length > 0 && (
        <Section title="Skills">
          <ul className="flex flex-wrap gap-2">
            {profile.skills.map((s) => (
              <li
                key={s}
                className={`rounded-lg border px-2.5 py-1 text-sm ${flagged.has(s) ? "border-dashed border-pass" : "border-border"}`}
              >
                {s}
                {flagged.has(s) && <span className="sr-only"> (needs review)</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {profile.education.length > 0 && (
        <Section title="Education">
          <ul className="space-y-3">
            {profile.education.map((e, i) => (
              <li key={`${e.school}-${i}`}>
                <p className="font-semibold">
                  <Flag on={flagged.has(e.school)}>{e.school}</Flag>
                </p>
                <p className="text-sm text-muted">
                  {[e.degree, e.field].filter(Boolean).join(", ")}
                  {formatDateRange(e.startDate, e.endDate) && ` · ${formatDateRange(e.startDate, e.endDate)}`}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {profile.certifications.length > 0 && (
        <Section title="Certifications">
          <ul className="space-y-2 text-sm">
            {profile.certifications.map((c, i) => (
              <li key={`${c.name}-${i}`}>
                <Flag on={flagged.has(c.name)}>
                  <span className="font-medium">{c.name}</span>
                </Flag>
                {[c.issuer, c.date].filter(Boolean).length > 0 && (
                  <span className="text-muted"> · {[c.issuer, c.date].filter(Boolean).join(" · ")}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Highlights a value the truthfulness check could not trace back to the uploaded resume. */
function Flag({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <mark className="rounded bg-transparent underline decoration-pass decoration-wavy decoration-2 underline-offset-4">
      {children}
      <span className="sr-only"> (needs review)</span>
    </mark>
  );
}

function WarningsPanel({ warnings }: { warnings: VerificationWarning[] }) {
  return (
    <section role="note" className="rounded-3xl border-2 border-pass/40 bg-card p-5" aria-label="Items to double-check">
      <h3 className="flex items-center gap-2 font-semibold">
        <AlertTriangle aria-hidden className="size-5 text-pass" /> {warnings.length} item(s) to double-check
      </h3>
      <p className="mt-1 text-sm text-muted">
        We couldn&apos;t find these word-for-word in your resume. They are underlined below. Tailored resumes will only
        use what you confirm is true.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {warnings.map((w, i) => (
          <li key={`${w.field}-${i}`}>
            <span className="font-medium capitalize">{w.field}:</span> {w.value}
          </li>
        ))}
      </ul>
    </section>
  );
}
