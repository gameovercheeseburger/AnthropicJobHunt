# Deploying AnthropicJobHunt (private beta)

Stack: **Vercel** (website) + **Neon** (Postgres with pgvector) + **Cloudflare R2** (encrypted resume files).
The whole site sits behind a Super Admin sign-in until user accounts ship.

Secrets live only in `.env.production.local` (git-ignored) and in Vercel's environment settings.
Never commit them. The GitHub repo is public.

## 1. Neon (database)

1. Sign up at https://neon.tech and create a project. Pick the region closest to Canada
   (e.g. AWS `us-east-2` / `ca-central-1` if offered) and Postgres 17.
2. **Connect** → copy the **pooled** connection string (host contains `-pooler`) into
   `DATABASE_URL`, and the **direct** one (no `-pooler`) into `DATABASE_URL_UNPOOLED`.

## 2. Cloudflare R2 (file storage)

1. Sign up at https://dash.cloudflare.com → **R2 Object Storage** (free tier needs a card on file;
   10 GB free).
2. **Create bucket** named `anthropic-job-hunt-resumes` (location: automatic / North America).
3. **Manage R2 API Tokens → Create API token** with *Object Read & Write*, limited to that bucket.
   Copy **Access Key ID** → `S3_ACCESS_KEY_ID`, **Secret Access Key** → `S3_SECRET_ACCESS_KEY`.
4. Your **Account ID** is on the R2 overview page: set
   `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

## 2b. JSearch (Google for Jobs: LinkedIn, Indeed, Job Bank listings), optional

1. Sign up at https://rapidapi.com and open the **JSearch** API (by OpenWeb Ninja) → **Pricing** →
   subscribe to the free/basic plan.
2. Copy your **X-RapidAPI-Key** into `JSEARCH_API_KEY`.
3. The default searches use 6 requests per daily run (~180/month). If your plan allows more, raise
   `maxRequestsPerRun` and add queries in the `jsearch` row of the `sources` table.

## 3. Fill in `.env.production.local`

Also set `ANTHROPIC_API_KEY`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`.
`DATA_ENCRYPTION_KEY` and `AUTH_SECRET` were generated for you. **Back up `DATA_ENCRYPTION_KEY`**:
losing it makes stored resumes unreadable.

## 4. Create the production tables and load jobs

```bash
ENV_FILE=../../.env.production.local npm run db:migrate
ENV_FILE=../../.env.production.local npm run db:seed
ENV_FILE=../../.env.production.local npm run ingest
```

The seed creates the Super Admin account. `ingest` loads real jobs located in Canada from the
public Greenhouse, Lever and Ashby boards in `packages/connectors/src/default-sources.ts`.
After deployment, Vercel Cron refreshes them daily (`apps/web/vercel.json`) by calling
`/api/cron/ingest` with `CRON_SECRET`, which was generated for you in `.env.production.local`.

## 5. Put the code on GitHub

Use **GitHub Desktop** (https://desktop.github.com): sign in as `gameovercheeseburger`,
**File → Add local repository** → this project folder → **Publish/Push** to
`gameovercheeseburger/AnthropicJobHunt`. After that, every push redeploys automatically.

## 6. Vercel

1. Sign up at https://vercel.com with GitHub.
2. **Add New → Project → Import** `gameovercheeseburger/AnthropicJobHunt`.
3. **Root Directory:** `apps/web` (framework: Next.js, detected automatically).
4. **Environment Variables:** paste the full contents of `.env.production.local`
   (`DATABASE_URL_UNPOOLED` can be left out; it is only used for migrations).
5. **Deploy.** Open the URL and sign in with your admin username and password.

## Updating

Push to `main` (GitHub Desktop → Commit → Push). If a change adds a migration, run step 4's
`db:migrate` command before or right after the push.
