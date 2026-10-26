# AnthropicJobHunt

Swipe through jobs gathered from across the web. Swipe right to apply, and AI tailors your resume
to the job, truthfully (it never invents experience).

**Status:** foundation + swipe deck. See the build plan below.

## Quick start (local)

Requirements: Node 22+, Docker Desktop.

```bash
cp .env.example .env          # then fill DATA_ENCRYPTION_KEY and AUTH_SECRET (commands are in the file)
npm install
npm run setup                 # starts Postgres/S3/Mailpit in Docker, runs migrations, creates the admin account
npm run ingest                # loads real jobs in Canada (about 20s)
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
packages/db       Drizzle schema, migrations, repository adapters
packages/infra    Encryption, S3 storage, DOCX/PDF text extraction
packages/ai       Claude resume parser (structured outputs)
packages/connectors  Job sources: Greenhouse, Lever, Ashby (+ default boards)
packages/app      Composition root shared by web app, scripts, and cron
docs/             Architecture and design-pattern guide
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before adding code. The project follows its patterns strictly.

## Build plan

- [x] Foundation: monorepo, Docker services, full data model, swipe deck
- [x] Resume upload + AI parsing (Profile page), truthfulness check, encryption
- [x] Real jobs in Canada from Greenhouse, Lever, Ashby (`npm run ingest`, daily cron)
- [x] Private-beta Super Admin sign-in + Vercel/Neon/R2 deploy guide (docs/DEPLOY.md)
- [ ] Auth (email magic link + Google) and profile
- [ ] Search + filters + "matches my profile" ranking
- [ ] AI resume tailoring with no-fabrication validator, diff view, PDF/DOCX export
- [ ] Application tracker (Kanban)
- [ ] More sources: JSearch (Google for Jobs: LinkedIn, Indeed, Job Bank listings), Adzuna, Jooble (free API keys needed)
