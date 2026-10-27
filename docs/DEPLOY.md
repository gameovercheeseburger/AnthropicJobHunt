# Deploying AnthropicJobHunt (private beta)

Stack: **Vercel** (website) + **Neon** (Postgres) + **Cloudflare R2** (encrypted resume files, capped at 8 GB).
The whole site sits behind a Super Admin sign-in until user accounts ship.

Every secret goes **only into Vercel's Environment Variables**. Nothing secret is committed; the repo is public.
Each production deploy applies database migrations and creates the Super Admin account automatically
(`vercel-build` → `packages/db/scripts/release.ts`). Preview deploys never touch the database.

## 1. Vercel project

1. Sign in at https://vercel.com with GitHub (account `gameovercheeseburger`).
2. **Add New… → Project → Import** `gameovercheeseburger/AnthropicJobHunt`.
3. **Root Directory:** click *Edit* and choose `apps/web`. Framework: Next.js (auto-detected).
4. Don't deploy yet: first add the environment variables below (expand **Environment Variables** on the
   import screen, or add them later under **Settings → Environment Variables** and redeploy).

## 2. Database: connect Neon (adds the variables for you)

In the Vercel project: **Storage → Connect Database → Neon** → choose your existing Neon project
(or **Settings → Integrations → Neon**). This adds `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`
(direct) automatically. Doing it by hand instead: copy both strings from Neon → **Connect** with
pooling on / off.

## 3. Environment variables to add

| Name | Value |
|---|---|
| `S3_ENDPOINT` | `https://<R2 account id>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto` |
| `S3_BUCKET` | `anthropic-job-hunt-resumes` (must match your R2 bucket) |
| `S3_ACCESS_KEY_ID` | R2 API token → Access Key ID |
| `S3_SECRET_ACCESS_KEY` | R2 API token → Secret Access Key |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `ADMIN_USERNAME` | your choice |
| `ADMIN_PASSWORD` | your choice (a strong, new one) |
| `DATA_ENCRYPTION_KEY` | copy from `.env.production.local` (pre-generated). **Back it up**: losing it makes stored resumes unreadable |
| `AUTH_SECRET` | copy from `.env.production.local` (pre-generated) |
| `CRON_SECRET` | copy from `.env.production.local` (pre-generated) |
| `STORAGE_LIMIT_GB` | `8` |
| `JSEARCH_API_KEY` | optional: RapidAPI → JSearch (adds LinkedIn / Indeed / Job Bank listings) |

## 4. Deploy

Click **Deploy**. The build log shows `[release] Applying database migrations…` then the Next.js build.
When it finishes, open the URL (e.g. `https://anthropic-job-hunt.vercel.app`), sign in with your admin
username and password, go to **Profile → Refresh jobs now** to load jobs immediately (it then runs daily),
and upload your resume.

## Updating

Push to `main` and Vercel redeploys automatically, migrations included.
`npm run storage:check` (with `ENV_FILE` pointing at production settings) shows R2 usage against the cap.
