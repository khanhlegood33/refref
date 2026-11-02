# Deploying RefRef to Vercel

The production deployment of the RefRef console (`apps/webapp`) lives in the
Vercel team **khanhle33**:

| Item | Value |
| --- | --- |
| Dashboard | https://vercel.com/khanhle33/refref |
| Production URL | https://refref.vercel.app |
| Team URL | https://refref-khanhle33.vercel.app |
| Framework | Next.js 16 (`apps/webapp`) |
| Git | `khanhlegood33/refref`, branch `arena/9b77d734-refref` |

Preview/branch domains are protected by Vercel SSO. The production
`*.vercel.app` aliases are the public entry points.

## How the build is configured

The repo is a pnpm/Turborepo monorepo, so the project uses
`apps/webapp` as its **Root Directory** and the commands from
[`apps/webapp/vercel.json`](apps/webapp/vercel.json):

- Install: `cd ../.. && pnpm install --frozen-lockfile`
- Build: `cd ../.. && pnpm turbo run build --filter=@refref/webapp...`

Turborepo builds the workspace packages (`@refref/types`, `@refref/coredb`,
`@refref/auth`, the widget/attribution bundles, …) before `next build`.

## Environment variables

Set these on the Vercel project (Project Settings → Environment Variables) for
Production, Preview and Development:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | **Required at runtime.** PostgreSQL connection string (Neon, Supabase, Vercel Postgres, …). |
| `BETTER_AUTH_SECRET` | Random secret, e.g. `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Public origin, e.g. `https://refref.vercel.app`. |
| `NEXT_PUBLIC_APP_URL` | Same public origin. |
| `NEXT_PUBLIC_ASSETS_URL` | CDN that hosts `attribution.v1.js` / `widget.v1.js` (defaults to `http://localhost:8787`). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional, enables Google sign-in. |
| `RESEND_API_KEY` | Optional, enables transactional email. |

> If `DATABASE_URL` is a placeholder, the build succeeds but any page that
> reads the session (`/`, `/auth/*`, `/api/auth/*`, `/api/trpc/*`) returns a
> 500 because Better Auth queries PostgreSQL. A real database is required for
> a functional site.
>
> Do **not** set `SKIP_ENV_VALIDATION` on Vercel: `@/env` applies Zod defaults
> and transforms at import time, and skipping validation leaves
> `NEXT_PUBLIC_ENABLED_SOCIAL_AUTH` undefined, which makes `getAuth()` throw
> `Cannot read properties of undefined (reading 'reduce')` during
> `next build`. Provide `DATABASE_URL` and `BETTER_AUTH_SECRET` instead.

## Database setup

```bash
export DATABASE_URL="postgresql://user:password@host:5432/refref?sslmode=require"
pnpm -F @refref/coredb db:push   # create the Drizzle schema
pnpm -F @refref/coredb db:seed   # optional template data
```

Then redeploy (or just update `DATABASE_URL` in Vercel and redeploy — env
changes require a new deployment to take effect).

## Redeploy

A push to the connected GitHub branch followed by a deploy from the Vercel
dashboard (or the Vercel API `POST /v13/deployments` with
`gitSource: { type: "github", repoId: 1443235999, ref: "<branch>" }`) creates
a new production deployment.
