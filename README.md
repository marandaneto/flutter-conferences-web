# flutter-conferences

Community-curated list of conferences for Flutter developers. Live at **[flutterconferences.com](https://www.flutterconferences.com)**.

Successor to [marandaneto/flutter-conferences](https://github.com/marandaneto/flutter-conferences) (Jekyll on GitHub Pages). Same site, but conferences live in a Postgres database with a moderated submission flow instead of pull requests against markdown files.

## Stack

- **Frontend** — Vite + React + TypeScript, Tailwind, TanStack Query, React Router
- **Backend** — Fastify + Drizzle ORM, Postgres
- **Shared** — Zod schemas + types in a workspace package consumed by both
- **Auth** — GitHub OAuth for users, single break-glass `ADMIN_TOKEN` for emergencies
- **Email** — Resend (admin notifications + submitter status updates)
- **Hosting** — [Railway](https://railway.com): two services (`@fc/api`, `@fc/web`) plus the Postgres plugin
- **DNS** — [Cloudflare](https://cloudflare.com) (`flutterconferences.com`, `www.*`, `api.*`)

## Layout

```
apps/
  api/        Fastify + Drizzle, Drizzle migrations + seed
  web/        Vite + React + TS + Tailwind
packages/
  shared/     zod schemas + types shared between api and web
```

## Features

**Public**

- Upcoming and Past pages with search + online-only / year filters
- ICS calendar feed at `/conferences.ics` for subscriptions
- Per-event "Add to Google Calendar" link and `.ics` download
- "Suggest edit" link on each conference (signed-in users)

**Submitter (any GitHub account)**

- `/suggest` — propose a new conference (auth-gated, rate-limited, duplicate-detected)
- `/suggest-edit/:slug` — propose changes to a listed conference
- Email on approve/reject

**Admin (invited GitHub users + break-glass token)**

- Pending queue (edit-and-approve flow)
- All-conferences table with inline edit/delete
- Edits queue with field-by-field diff and apply/reject controls
- Add-new with the same duplicate guard (override available)
- Members tab — invite by GitHub username, manage access

## Auth model

There are two independent ways to act as an admin:

1. **GitHub OAuth + invite.** An admin invites a GitHub username; that account becomes admin on first sign-in. Sessions are server-side (random tokens stored in the `sessions` table, sent as `Authorization: Bearer …`).
2. **`ADMIN_TOKEN`** — a single shared secret used as `Bearer <token>`. Treat as break-glass: if you lose access, rotate it via Railway env var and redeploy. Token holders can do anything except submit via `/suggest` (use the admin "Add new" tab instead).

Anyone signed in via GitHub but not invited is a "guest" — they can submit suggestions and edits but can't access the admin panel.

## Local development

Requires Node 20+, pnpm 10, Docker (for the local Postgres).

```sh
pnpm install
cp .env.example apps/api/.env

pnpm db:up           # start Postgres on :5433
pnpm db:migrate      # apply Drizzle migrations
pnpm db:seed         # imports existing _conferences/*.md from the original repo
                     # (expects ../flutter-conferences sibling clone)

pnpm dev             # api on :3000, web on :5173
```

GitHub OAuth and Resend are optional locally — if their env vars are absent, sign-in is disabled and emails are silently skipped. The `ADMIN_TOKEN` from `.env` still works for the admin panel.

### Pre-commit hooks

`pnpm install` runs husky's `prepare` script which sets up a pre-commit hook that runs `lint-staged` (eslint --fix + prettier --write on staged files) and `pnpm typecheck` across all workspaces. If your pnpm is configured with `ignore-scripts=true`, bootstrap the hook once manually:

```sh
pnpm husky
```

## Deployment notes

Both Railway services use config-as-code (`apps/{api,web}/railway.json`):

- `@fc/api` runs `pnpm db:migrate && pnpm start` on each deploy. Listens on `$PORT`.
- `@fc/web` builds with Vite (`pnpm build`) and serves `dist/` via `sirv-cli`.

Required env vars on `@fc/api`:

- `DATABASE_URL` — referenced from the Postgres plugin
- `ADMIN_TOKEN` — long random secret
- `CORS_ORIGIN` — comma-separated allowed origins (e.g. `https://www.flutterconferences.com,https://flutterconferences.com`)
- `WEB_URL` — canonical web origin used in OAuth redirects and email links
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_CALLBACK_URL` — your GitHub OAuth app
- `SESSION_SECRET` — used to HMAC-sign the OAuth state parameter
- `RESEND_API_KEY` — Resend API key for outbound email
- `NOTIFICATION_EMAIL` (optional) — fallback recipient for admin notifications when no admin user has an email set; admin notifications normally go to all `users` rows where `is_admin = true` and `email IS NOT NULL`
- `NOTIFICATION_FROM` (optional) — sender override; defaults to Resend's `onboarding@resend.dev`

Required env vars on `@fc/web`:

- `VITE_API_URL` — full API origin, baked in at build time

## Migrations

Drizzle migrations live in `apps/api/drizzle/`. Generate with `pnpm db:generate` after editing `apps/api/src/db/schema.ts`. Hand-edit the generated SQL when you need data backfills (see `0002_stiff_lifeguard.sql` for an example).

## License

[MIT](LICENSE) — code. Conference data carries forward the original CC0 dedication.
