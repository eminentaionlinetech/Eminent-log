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
