# Lithos Starter — agent rules

A partner app built on the Lithos partner API. It wears a demo brand (Eucardia
Health, a fictional cardiometabolic membership). The brand — name, tagline,
colour, logo — lives in `starter.config.json` and is edited live from the "Make
it yours" panel (the first-run pop-up, and `/setup`, the Developer page); logos go in `public/brand/`. Nothing secret belongs
in that file. The chosen **program** (`lipid_management` or `weight_management`)
is saved there too and drives the patient-facing copy (`src/lib/programs/content.ts`)
and the care-review intake (`src/lib/intake/`, `src/lib/journey.ts`). The
membership side (`/join`, `/me`, `/members`) is written for lipid management only.
Start with `README.md`.

## Helping someone try the starter for the first time

The first run is the product demo, so leave the discovering to the person:

1. Clone (or unzip, if it was sent after a demo — `START-HERE.md` is then in the
   folder), `npm install`, `npm run dev`.
2. `npm run dev` opens **http://localhost:3001**, the home page, with a pop-up
   to connect to Lithos. Hand over there. Tell them the pop-up takes the client
   ID and secret from their Lithos console, then lets them choose a program and
   make the app theirs, and that the bar at the top then shows their sandbox
   checklist and what to do next. Then stop.

Don't walk the intake, play the clinician or tour the app on their behalf unless
they ask. Never enter their client ID or secret: the pop-up has a form for that.
Once they've connected, help with whatever they ask.

## Boundaries — don't engineer around these

- Call only the public partner API: `https://api.sandbox.lithoshealth.com/v1/...`.
  M2M client-credentials only, minted server-side. The client id and secret must
  never reach the browser.
- **Sandbox only, obviously fake patients only.** `src/lib/journey.ts` and
  `src/lib/join.ts` enforce Sample/Test names, `example.com` emails and 555
  phones; `src/lib/setup/steps.ts` refuses any non-sandbox base URL. The API
  client refuses one too (`src/lib/lithos/sandbox.ts`) unless
  `LITHOS_ALLOW_NON_SANDBOX=1`, and outside the sandbox the patient app's demo
  sign-in and the ops pages switch off (`src/lib/portal/session.ts`,
  `src/lib/ops-guard.ts`). Keep all of those guards.
- Secrets only via env vars — `.env.example` documents the names. `.env.local`
  is gitignored; never commit it, never echo it.
- Errors from the API render honestly — status plus the `errors[]` envelope
  (`code`, `message`, `source.pointer`) — even in patient-facing UI.
- `src/lib/escalation.ts` holds **illustrative** eligibility rules, not Lithos's
  clinical criteria. Don't present them as authoritative.

## Conventions

- Next.js App Router + TypeScript, port **3001**. Keep dependencies minimal —
  this is reference code people read.
- Integration code lives in `src/lib/`: `lithos/` (token cache, client, error
  envelope, types), `webhooks/` (signature verification, handler, attempt log),
  `events/` (event store), `setup/` (the Developer page and connecting), and
  `dev-progress.ts` (the sandbox checklist in the top bar).
- **Two route groups, two kinds of chrome.** `src/app/(site)/` is the patient-facing
  app; `src/app/(dev)/` is the Developer page. The root layout is only the
  document shell. Route groups don't change URLs.
- **The Developer page and the top bar's checklist derive every check from a live API call.** Never mark a
  step done from local state alone — that's what makes it trustworthy.
- **Every create is idempotent.** Patients, care plans, encounters, conversations,
  messages and webhook endpoints are sent with an `Idempotency-Key` from the
  attempt (`src/lib/lithos/idempotency.ts`); forms carry one in
  `<IdempotencyField />` (`src/app/idempotency-field.tsx`). The attempt also
  fixes the body — consent time, sample external ids — because Lithos refuses a
  key reused with a different body. A new create follows the same pattern.
- **Webhooks are thin.** An event carries a type and a `resource_id`; re-read the
  resource with a `GET` and store that. Never treat a payload as state.
- **Webhooks are answered first, processed after** (`after()` in
  `src/app/api/webhooks/lithos/route.ts`): verify, store, respond, then project
  and notify the patient (`src/lib/notifications/`). Notifications carry no
  clinical detail — they say something is waiting and link into the app.
- **The database:** Postgres. With no `DATABASE_URL`, `npm run dev` runs it
  embedded (PGlite, `src/lib/embedded-db.ts`, data in `.lithos-db/`, started by
  `src/instrumentation.ts`), so it's always there locally; a deployed app sets
  `DATABASE_URL`. With a `DATABASE_URL` in development, the same start applies
  `db/schema.sql` to it (`src/lib/apply-schema.ts`), so keep the schema idempotent. Scripts find the running app's database through
  `db/running.mjs` — never open `.lithos-db/` from a second process.
- **The event store:** Postgres when `DATABASE_URL` is set (locally, always),
  Upstash Redis when deployed without it. The deployed app refuses to fall back
  to process memory.

## Routes

| Route | Audience | Purpose |
|---|---|---|
| `/setup` | developer | the Developer page: connection, program, brand, webhooks |
| `/` | patient | marketing landing (membership first, care as the escalation) |
| `/start` | patient | direct intake → patient, care plan, encounter |
| `/care/[encounterId]` | patient | plain-language care status |
| `/portal`, `/portal/messages`, `/portal/support` | patient | the patient's app, with its own chrome (`src/app/(portal)/`): prescription and delivery, the plan, a care-team chat, help — read live from Lithos. The demo sign-in picks someone from your own records (a member, care-only or not); their Lithos patient is the link on that record. On a local sandbox copy, demo controls move the patient along |
| `/join`, `/welcome/[id]` | patient | membership signup — writes to your own DB, no Lithos call |
| `/me/[id]`, `/me/[id]/care-review` | member | member dashboard; member-initiated escalation into care |
| `/members`, `/members/[id]` | ops | the partner's own record, Lithos projections, escalation, inquiry replies |
| `/journeys`, `/events`, `/status/[id]` | ops | sandbox journeys; verified webhook log; raw encounter JSON |
| `/api/webhooks/lithos` | Lithos | signed webhook receiver |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
