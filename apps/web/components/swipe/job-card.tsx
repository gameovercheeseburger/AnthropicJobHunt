import { Banknote, Clock, ExternalLink, MapPin } from "lucide-react";
import type { JobCardView } from "@/lib/presenters/job-card";

/** Presentational card. Purely props-driven so it renders the same in the deck, queue, and tracker. */
export function JobCard({ job }: { job: JobCardView }) {
  return (
    <article
      aria-label={`${job.title} at ${job.companyName}`}
      className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-black/5"
    >
      <header className="flex items-center gap-3 border-b border-border p-5">
        <div
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-xl font-semibold text-brand-foreground"
        >
          {job.companyInitial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted">{job.companyName}</p>
          <h2 className="text-xl leading-tight font-semibold text-balance">{job.title}</h2>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        <ul className="flex flex-wrap gap-2" aria-label="Job details">
          {job.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-chip px-3 py-1 text-sm font-medium">
              {tag}
            </li>
          ))}
        </ul>

        <dl className="grid gap-2 text-sm">
          {job.location && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Location</dt>
              <MapPin aria-hidden className="size-4 text-muted" />
              <dd>{job.location}</dd>
            </div>
          )}
          {job.salaryLabel && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Salary</dt>
              <Banknote aria-hidden className="size-4 text-muted" />
              <dd className="font-medium">{job.salaryLabel}</dd>
            </div>
          )}
          {job.postedLabel && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Posted</dt>
              <Clock aria-hidden className="size-4 text-muted" />
              <dd className="text-muted">{job.postedLabel}</dd>
            </div>
          )}
        </dl>

        <p className="leading-relaxed">{job.summary}</p>

        {job.skills.length > 0 && (
          <section aria-label="Skills">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Skills</h3>
            <ul className="flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <li key={skill} className="rounded-lg border border-border px-2.5 py-1 text-sm">
                  {skill}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="border-t border-border p-4">
        <a
          href={job.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          // Let taps on the link work without starting a drag.
          onPointerDownCapture={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand underline-offset-4 hover:underline focus-visible:underline"
        >
          View original posting <ExternalLink aria-hidden className="size-3.5" />
        </a>
      </footer>
    </article>
  );
}
