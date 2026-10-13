# EMINENT LOG

**Learn. Create. Teach. Grow.** — a custom learning management system with courses, real video/PDF lessons, progress tracking, role-based administration, and Korapay-powered Premium subscriptions (₦10,000 / month).

> Status: feature-complete foundation, **not yet verified end-to-end in production**. See [Production readiness](#9-production-readiness).

---

## 1. System overview & architecture

| Layer | Technology |
| --- | --- |
| Framework | TanStack Start v1 (SSR + server functions), React 19, Vite 7 |
| Styling | Tailwind CSS v4 (configured in `src/styles.css`), shadcn/ui primitives |
| Database | PostgreSQL (Supabase / Lovable Cloud) with Row-Level Security |
| Auth | Supabase Auth (email/password + Google), session persisted in browser storage |
| Storage | Private Supabase Storage bucket `course-media` |
| Payments | Korapay (redirect checkout + signed webhook, server-side verification) |
| Migrations | Drizzle Kit, SQL files in `drizzle/migrations/` |
| Runtime target | Edge worker (Cloudflare Workers via Nitro); Node also supported |

```text
Browser (React) ──► Server functions (createServerFn, src/lib/*.functions.ts)
   │                    │  requireSupabaseAuth → RLS-scoped client
   │                    │  supabaseAdmin (service role) only after checks
   ▼                    ▼
Supabase Auth      PostgreSQL (RLS + SECURITY DEFINER functions) ── Storage (course-media, private)
                        ▲
Korapay ──webhook──► /api/public/korapay-webhook ──► verify charge with Korapay API ──► grant_premium_payment()
```

Key directories:

- `src/routes/` — file-based routes (public pages, `_authenticated/` for signed-in pages incl. `admin.*`, `api/public/` for webhooks)
- `src/lib/` — server functions (`courses`, `learning`, `premium`), Korapay client (`korapay.server.ts`), helpers
- `src/components/` — site, admin and UI components
- `drizzle/migrations/` — schema, RLS, SQL functions, seed data
- `AGENTS.md` — architecture rules that must stay true

## 2. Local development

Prerequisites: **Node 20+** and **Bun** (recommended) or npm, plus access to a Supabase project.

```sh
git clone <this-repository-url> eminent-log
cd eminent-log
bun install            # or: npm install
cp .env.example .env   # then fill in real values
bun run dev            # http://localhost:8080
```

Other scripts: `bun run build`, `bun run preview`, `bun run lint`, `bun run test`.

See `.env.example` for every variable. Rules:
- `VITE_*` values are bundled into the browser — publishable keys only.
- `SUPABASE_SERVICE_ROLE_KEY` and `KORAPAY_SECRET_KEY` are server-only; never prefix them with `VITE_` or log them.

## 3. Database & storage

### Migrations
Applied in order:
1. `drizzle/migrations/0000_migration.sql` — enums, tables (profiles, user_roles, categories, instructors, media, courses, modules, lessons, lesson_resources, enrolments, lesson_progress, subscriptions, payments, site_settings), RLS policies, `has_role`, `can_access_course`, `has_active_premium`, catalogue helpers, signup trigger, seed categories/draft courses/curriculum.
2. `drizzle/migrations/0001_progress_and_premium.sql` — `record_lesson_progress`, `grant_premium_payment`, payment/subscription hardening.

```sh
export LOVABLE_DB_MIGRATION_URL="postgresql://..."
bunx drizzle-kit migrate
# or apply directly:
psql "$LOVABLE_DB_MIGRATION_URL" -f drizzle/migrations/0000_migration.sql
psql "$LOVABLE_DB_MIGRATION_URL" -f drizzle/migrations/0001_progress_and_premium.sql
```

### Storage bucket
Create a **private** bucket named `course-media` (Supabase dashboard or `insert into storage.buckets (id, name, public) values ('course-media','course-media', false);`). Do not make it public — lesson files are served via short-lived signed URLs.

### Security model
- RLS is enabled on every public table. Students read published catalogue data and only their own profile, enrolments, progress, subscriptions and payments.
- Writes to courses/modules/lessons/media/categories require `has_role(auth.uid(),'admin')`.
- Sensitive mutations go through `SECURITY DEFINER` functions:
  - `record_lesson_progress` — checks auth, published lesson, enrolment and access; computes course completion.
  - `grant_premium_payment` — service-role only; idempotently activates/extends Premium by 30 days.
  - `can_access_course`, `has_active_premium`, `has_role` — authorization helpers.

## 4. Authentication & roles

- Every new user gets a `profiles` row and the `student` role via the `on_auth_user_created` trigger (`handle_new_user`).
- **Admin bootstrap:** the trigger also grants `admin` to `eminentlattice@gmail.com` on signup. To change/add admins, insert into `public.user_roles` with a privileged connection:
  ```sql
  insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'new-admin@example.com';
  ```
- Roles live only in `user_roles` (never on profiles or user metadata); users cannot write that table.
- Admin pages live under `src/routes/_authenticated/admin.*`; data access is enforced by RLS, not by hidden buttons.
- Sessions persist in browser storage and auto-refresh; authenticated server functions receive the bearer token via `attachSupabaseAuth` (`src/start.ts`).
- Suspended accounts (`profiles.account_status`) cannot start checkout.
- Enable email/password and Google providers in your Supabase Auth settings; set Site URL and redirect URLs to your domain.

## 5. Media system

All files live in the private `course-media` bucket and are tracked in `public.media` (kind, mime type, size, duration, storage path).

| Type | Usage | Delivery |
| --- | --- | --- |
| Video (mp4/webm/mov) | Attached to a lesson (`lessons.video_media_id`) | Signed URL (3 h) from `getLessonPlayback` after enrolment + access checks |
| PDF / resources | `lesson_resources` linking lessons to media | Signed URL (3 h), same checks |
| Thumbnails / images | `courses.thumbnail_media_id` | Long-lived signed URL |

- Uploads are admin-only (Media Library / pickers). Video duration is read from real file metadata; if unknown, no duration is shown.
- One media item can be attached to many lessons — no duplicate uploads.
- Lessons without a video show no player.

## 6. Korapay payments

Flow:
1. Student clicks *Get Premium* → `startPremiumCheckout` creates a `pending` payment (`EL-…` reference, 1,000,000 kobo) and initializes a Korapay charge.
2. Student pays on Korapay and is redirected to `/premium?reference=…`; `confirmPremiumPayment` re-queries Korapay.
3. Korapay also calls **`POST /api/public/korapay-webhook`**. The handler verifies `x-korapay-signature` (HMAC-SHA256 of `data` with the secret key), then **re-fetches the charge from Korapay** before calling `grant_premium_payment`.
4. Premium is active while `subscriptions.status='active'` and `current_period_end > now()` (30 days per payment; renewals extend).

Setup:
- Set `KORAPAY_SECRET_KEY` (test key in staging, live key in production).
- In the Korapay dashboard set the webhook URL to `https://<your-domain>/api/public/korapay-webhook`.
- Without the secret, checkout is shown as unavailable; the webhook returns 503.

## 7. Building & deploying outside Lovable

```sh
bun run build        # output in .output/ (Nitro)
```

- **Cloudflare Workers (default target):** deploy `.output` with `wrangler deploy`; set env vars as Worker secrets.
- **Node:** build with a Node preset (`NITRO_PRESET=node-server bun run build`) and run `node .output/server/index.mjs`; place behind a reverse proxy with HTTPS.
- **Vercel / Netlify:** use `NITRO_PRESET=vercel` or `netlify`; configure env vars in the platform dashboard.
- **Docker:**
  ```dockerfile
  FROM oven/bun:1 AS build
  WORKDIR /app
  COPY . .
  RUN bun install --frozen-lockfile && NITRO_PRESET=node-server bun run build
  FROM node:20-slim
  WORKDIR /app
  COPY --from=build /app/.output ./.output
  ENV PORT=3000
  EXPOSE 3000
  CMD ["node", ".output/server/index.mjs"]
  ```
- **Own Supabase/PostgreSQL:** create a project, run both migrations, create the `course-media` bucket, configure Auth providers, and point all `SUPABASE_*` variables at it. Server code must run on a runtime with `fetch` and Web Crypto (all of the above).

## 8. Backup & restore

Database:
```sh
pg_dump "$DATABASE_URL" -Fc --schema=public --schema=auth -f eminent-log-$(date +%F).dump
pg_restore --clean --if-exists --no-owner -d "$TARGET_DATABASE_URL" eminent-log-YYYY-MM-DD.dump
```
Back up `storage.objects` metadata alongside (`--schema=storage`) when restoring to the same project.

Media (Supabase CLI or any S3-compatible tool against Supabase Storage's S3 endpoint):
```sh
aws s3 sync s3://course-media ./backup/course-media --endpoint-url https://<ref>.supabase.co/storage/v1/s3
aws s3 sync ./backup/course-media s3://course-media --endpoint-url https://<new-ref>.supabase.co/storage/v1/s3
```
Keep `media.storage_path` values identical so database rows still resolve. Schedule daily DB dumps and weekly media syncs; test restores regularly.

## 9. Production readiness

External dependencies: Supabase (DB, Auth, Storage), Korapay (charges + webhooks), Google OAuth, hosting provider.

Pre-launch checklist:
- [ ] Sign up as the admin email and confirm the `admin` role
- [ ] Upload real course video/PDF, publish a course, verify enrolment, playback, resume and completion
- [ ] Register Korapay webhook URL and complete a real/test payment; confirm Premium activates
- [ ] Verify a non-premium student cannot open premium lessons or signed URLs
- [ ] Run security scan / RLS review; confirm backups

## 10. Roadmap

- Live Korapay end-to-end test (pending)
- End-to-end test with real admin-uploaded course content (pending)
- Stricter lesson completion rules (watch-percentage based)
- Shorter-lived thumbnail URLs / CDN image delivery
- Recurring-billing automation and expiry notifications
- Certificates of completion (only once completion is verified)

---

## 11. Restore & transfer runbook (running EMINENT LOG outside Lovable)

This runbook rebuilds EMINENT LOG from the exported source on infrastructure you control. Every step reflects files that exist in this repository. Steps marked **MANUAL** cannot be automated or transferred from the current environment.

### 11.1 What transfers and what does not

| Item | Transfers with source? | Notes |
| --- | --- | --- |
| Application code, routes, styles, assets | Yes | `src/`, `public/` |
| Database schema, RLS, SQL functions, seed categories/draft courses | Yes | `drizzle/migrations/0000_migration.sql`, `0001_progress_and_premium.sql` |
| Database rows (users, enrolments, progress, payments, subscriptions) | **No** | Must be exported with `pg_dump` from the source project (11.9) |
| Auth users & password hashes | **No** | Live in the `auth` schema; only via `pg_dump --schema=auth` with privileged access |
| Uploaded media files | **No** | Must be copied from the `course-media` bucket (11.9) |
| Storage bucket itself | **No — MANUAL** | Create it in the new project (11.4) |
| Secrets (service role key, Korapay secret) | **No — MANUAL** | Re-enter on the new host; never commit them |
| Auth provider settings (Site URL, redirect URLs, Google OAuth) | **No — MANUAL** | Configure in the new Supabase project |
| Korapay webhook URL | **No — MANUAL** | Update in the Korapay dashboard |
| Google sign-in button | **Code change required** | See 11.6 — it uses Lovable's managed OAuth helper |

### 11.2 Prerequisites

- Node.js 20+ and Bun (or npm)
- `psql`, `pg_dump`, `pg_restore` (PostgreSQL client tools matching the server major version)
- A Supabase project (hosted or self-hosted). Plain PostgreSQL is **not** sufficient: the migrations reference the `auth` and `storage` schemas, `auth.uid()`, and the `authenticated`/`anon`/`service_role` roles, and the app uses Supabase Auth and Storage.
- Authorised access to: the source database (for data export), the source storage bucket, a Korapay merchant account, and (optional) a Google Cloud OAuth client.
- An S3-compatible CLI (e.g. AWS CLI) if using Supabase Storage's S3 endpoint for media copy.

### 11.3 Create the database and run migrations

1. Create a new Supabase project. From its settings, note the project URL, publishable (anon) key, service role key, and the direct Postgres connection string.
2. Apply migrations **in this exact order** (also recorded in `drizzle/migrations/meta/_journal.json`):
   1. `0000_migration.sql`
   2. `0001_progress_and_premium.sql`

   ```sh
   export LOVABLE_DB_MIGRATION_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
   bunx drizzle-kit migrate
   # or, equivalently:
   psql "$LOVABLE_DB_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/migrations/0000_migration.sql
   psql "$LOVABLE_DB_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/migrations/0001_progress_and_premium.sql
   ```
   Use one method only. `drizzle-kit migrate` records applied migrations in its own journal table; running `psql` afterwards would re-apply them and fail.
3. **If you will restore data from the old project (11.9), skip the seed-only expectations:** `0000` inserts categories, three draft courses and the website-design curriculum. When restoring a full `public` dump with `--clean`, those rows are replaced by the dump.

### 11.4 Storage bucket and permissions (MANUAL)

The migrations create storage policies but **not** the bucket. Create a **private** bucket named exactly `course-media`:

```sql
insert into storage.buckets (id, name, public) values ('course-media', 'course-media', false);
```
(or create it in the Supabase dashboard with "Public" turned off).

Policies created by `0000_migration.sql` on `storage.objects`:
- `admin all course-media` — admins (via `has_role`) may read/write/delete any object in the bucket.
- `anyone reads images folder` — anyone may read objects under `images/` (course thumbnails).

Lesson videos and PDFs (under `files/`) are only served by the server through short-lived signed URLs from `getLessonPlayback`. Never make the bucket public.

Note: thumbnails store a long-lived signed URL in `media.public_url`. Those URLs embed the **old** project's host and signing key and will break after transfer — re-upload or regenerate thumbnails via the admin Media Library after migrating media.

### 11.5 Environment variables

Copy `.env.example` to `.env` (local) or set them on your host. Required:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Browser (bundled at **build** time) | Client Supabase access |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Server | Server-side clients / auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Server, secret | Admin client: signed URLs, `grant_premium_payment` |
| `KORAPAY_SECRET_KEY` | Server, secret | Initialize & verify charges, webhook signature |
| `LOVABLE_DB_MIGRATION_URL` | CLI only | Used by `drizzle.config.ts` |

`VITE_KORAPAY_PUBLIC_KEY` and `APP_BASE_URL` are reserved and not read by current code. Because `VITE_*` values are baked in at build time, rebuild after changing them.

### 11.6 Authentication setup (MANUAL)

In the new Supabase project's Auth settings:
1. Enable the **Email** provider. Decide on email confirmation (signup sends `emailRedirectTo` = site origin).
2. Set **Site URL** to your production domain, and add redirect URLs for `https://<domain>` and `https://<domain>/reset-password` (password reset uses `redirectTo: <origin>/reset-password`). Add `http://localhost:8080` entries for local dev.
3. Configure SMTP for production email delivery (Supabase's default sender is rate-limited).
4. **Google sign-in requires a code change.** `src/routes/auth.tsx` calls `lovable.auth.signInWithOAuth` from `src/integrations/lovable/index.ts` (`@lovable.dev/cloud-auth-js`), which depends on Lovable's managed OAuth and will not work on another backend. To keep Google sign-in:
   - create an OAuth client in Google Cloud, add the Supabase callback `https://<ref>.supabase.co/auth/v1/callback`, enable the Google provider in Supabase with the client ID/secret;
   - replace the call with `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })`.
   Otherwise hide the Google button.

### 11.7 Secure initial administrator

- The `handle_new_user` trigger (in `0000_migration.sql`) gives every new user the `student` role and, **only** for the email `eminentlattice@gmail.com`, also `admin`. The trigger fires on account creation; ensure email confirmation is on so nobody else can register that address first.
- To use a different admin, either edit that email in the migration **before** applying it, or after the person signs up run with a privileged connection:
  ```sql
  insert into public.user_roles (user_id, role)
  select id, 'admin' from auth.users where email = '<admin-email>'
  on conflict do nothing;
  ```
- Verify: `select u.email, r.role from public.user_roles r join auth.users u on u.id = r.user_id;`
- Roles exist only in `public.user_roles`; users have no write access to it. Never grant roles via user metadata.

### 11.8 Payment provider (Korapay, MANUAL)

1. Set `KORAPAY_SECRET_KEY` on the server (test key for staging, live key for production).
2. In the Korapay dashboard, set the webhook/notification URL to `https://<domain>/api/public/korapay-webhook`. Checkout also passes `notification_url` and a `redirect_url` of `<origin>/premium?reference=…` derived from the request origin, so the site must be served on its final HTTPS domain.
3. The webhook checks `x-korapay-signature` (HMAC-SHA256 of the `data` object with the secret key), then re-fetches the charge from Korapay before calling `grant_premium_payment`. Only references matching `EL-` + 20 hex characters are processed.
4. Price is ₦10,000 (1,000,000 kobo) per 30-day period, defined in `src/lib/premium.functions.ts` and enforced in `grant_premium_payment`.
5. Without the secret, checkout shows as unavailable and the webhook returns 503.

### 11.9 Backup & restore of data and media

**Export from the source** (requires the source database connection string — on Lovable Cloud this is not exposed to users, so request an export through Lovable support or your authorised access):
```sh
pg_dump "$SOURCE_DB_URL" -Fc --data-only --schema=public -f eminent-public-data.dump
pg_dump "$SOURCE_DB_URL" -Fc --data-only -t auth.users -t auth.identities -f eminent-auth-users.dump
```

**Restore into the target** (after 11.3 and 11.4):
```sh
# auth users first so profiles/user_roles foreign keys resolve
pg_restore --data-only --no-owner --disable-triggers -d "$TARGET_DB_URL" eminent-auth-users.dump
# remove seed rows that would conflict, then load public data
psql "$TARGET_DB_URL" -c "truncate public.lessons, public.modules, public.courses, public.categories, public.profiles, public.user_roles restart identity cascade;"
pg_restore --data-only --no-owner --disable-triggers -d "$TARGET_DB_URL" eminent-public-data.dump
```
`--disable-triggers` needs superuser rights; it prevents `handle_new_user` from creating duplicate profile/role rows during the auth import. Test on a scratch project first.

**Media**: copy the bucket contents keeping paths identical (`media.path` must still resolve):
```sh
aws s3 sync s3://course-media ./backup/course-media --endpoint-url https://<old-ref>.supabase.co/storage/v1/s3
aws s3 sync ./backup/course-media s3://course-media --endpoint-url https://<new-ref>.supabase.co/storage/v1/s3
```
S3 access keys are created in each Supabase project's storage settings (MANUAL). Then regenerate thumbnail URLs (11.4).

### 11.10 Local development

```sh
bun install
cp .env.example .env    # fill in values for the new project
bun run dev             # http://localhost:8080
bun run test            # vitest
```

### 11.11 Deploy to another host

The build uses `@lovable.dev/vite-tanstack-config`, which bundles Nitro with **Cloudflare Workers** as the default target. Output goes to `.output/`.
- Cloudflare Workers: `bun run build`, then `wrangler deploy` (install Wrangler separately); add secrets with `wrangler secret put`.
- Node server: `NITRO_PRESET=node-server bun run build && node .output/server/index.mjs`, behind an HTTPS reverse proxy.
- Vercel / Netlify: set `NITRO_PRESET=vercel` / `netlify`.
- Always provide `VITE_*` vars at build time and server secrets at runtime.

Preset overrides follow Nitro's standard behaviour and have not been tested on this project — verify on staging.

### 11.12 Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `permission denied for table …` | Migrations not fully applied (GRANTs missing) — re-run in order |
| Admin pages empty or redirect | User lacks `admin` row in `user_roles` (11.7) |
| Uploads fail | Bucket `course-media` missing, or user not admin |
| Videos/PDFs don't load | `SUPABASE_SERVICE_ROLE_KEY` missing on server; learner not enrolled; premium inactive |
| Thumbnails broken after move | Old signed URLs — regenerate (11.4) |
| Google sign-in fails | Lovable OAuth helper still in use (11.6) |
| Reset email link goes to wrong site | Site URL / redirect URLs not updated |
| Webhook 401 | Wrong `KORAPAY_SECRET_KEY` for the environment (test vs live) |
| Webhook 503 | `KORAPAY_SECRET_KEY` not set |
| Premium not activating | Webhook URL not set in Korapay; check server logs for `[korapay]` |
| `Expected 3 parts in JWT` | A custom client is passing a `sb_publishable_`/`sb_secret_` key as a Bearer JWT; use the generated clients |

### 11.13 Final verification checklist

- [ ] Both migrations applied in order; `select count(*) from public.categories;` returns rows
- [ ] Private `course-media` bucket exists
- [ ] All env vars set; site builds and loads on HTTPS
- [ ] Register, confirm email, log in, log out, reset password
- [ ] Admin account has `admin` role and can open `/admin`
- [ ] A student account cannot open `/admin` or edit any course data
- [ ] Upload a video and PDF, attach to a lesson, publish course
- [ ] Enrol as student; video plays, resumes, progress saves, course completes
- [ ] Non-premium student cannot open premium lessons
- [ ] Korapay webhook URL set; a test payment activates Premium, visible in admin Payments
- [ ] Restored users, enrolments and media resolve correctly (if data was migrated)
- [ ] Database and media backups scheduled and a restore tested
