# AnthropicJobHunt

Swipe through jobs gathered from across the web. Swipe right to apply, and AI tailors your resume
to the job, truthfully (it never invents experience).

**Status:** foundation + swipe deck. See the build plan below.

## Quick start (local)

Requirements: Node 22+, Docker Desktop.

```bash
cp .env.example .env          # then fill DATA_ENCRYPTION_KEY and AUTH_SECRET (commands are in the file)
npm install
npm run setup                 # starts Postgres/S3/Mailpit in Docker, runs migrations, seeds sample jobs
npm run dev                   # http://localhost:3000
```

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | Type-check every workspace |
| `npm run db:generate` | Create a migration after editing `packages/db/src/schema` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Browse the database |
| `npm run services:down` | Stop Docker services |

Local services: Postgres on `localhost:5433`, S3 (SeaweedFS) on `localhost:8333`, Mailpit inbox at http://localhost:8025.

## Layout

```
apps/web          Next.js 16 app (App Router, Tailwind v4, PWA manifest)
packages/core     Domain, ports (interfaces), services. No framework dependencies
packages/db       Drizzle schema, migrations, repository adapters, field encryption
docs/             Architecture and design-pattern guide
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before adding code. The project follows its patterns strictly.

## Build plan

- [x] Foundation: monorepo, Docker services, full data model, swipe deck (seed data, dev user)
- [ ] Auth (email magic link + Google) and profile
- [ ] Resume upload + AI parsing
- [ ] Job source connectors (Greenhouse, Lever) + scheduled ingestion, dedup, expiry
- [ ] Search + filters + "matches my profile" ranking
- [ ] AI resume tailoring with no-fabrication validator, diff view, PDF/DOCX export
- [ ] Application tracker (Kanban)
- [ ] More sources (Ashby, Workable, SmartRecruiters, Adzuna, Jooble, USAJobs, Remotive, JSearch, schema.org)
