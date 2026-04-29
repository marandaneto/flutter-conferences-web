# flutter-conferences

Dynamic backend rewrite of [marandaneto/flutter-conferences](https://github.com/marandaneto/flutter-conferences). Vite + React frontend, Fastify + Postgres backend, deployable to Railway.

## Layout

```
apps/
  api/        Fastify + Drizzle (Postgres)
  web/        Vite + React + TS + Tailwind
packages/
  shared/     zod schemas + types shared between api and web
```

## Local dev

```sh
pnpm install
cp .env.example apps/api/.env
pnpm db:up           # start Postgres in docker
pnpm db:migrate      # run migrations
pnpm db:seed         # import existing _conferences/*.md from sibling repo
pnpm dev             # start api (3000) and web (5173) in parallel
```

## Features

- Public pages: upcoming, online-only, past
- ICS calendar feed at `/conferences.ics`
- Guest suggestion form (rate-limited + honeypot, no auth)
- Admin panel (token-gated): pending queue, edit-and-approve, edit/delete any conference

## Admin auth

Single bearer token in `ADMIN_TOKEN`. Admin panel stores it in localStorage. No user accounts.
