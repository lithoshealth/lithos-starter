# Lithos Starter — agent rules

A partner app built on the Lithos partner API. It wears a demo brand (Eucardia
Health, a fictional cardiometabolic membership). `NEXT_PUBLIC_APP_NAME` renames
the header and titles; page copy still names the demo brand. Start with `README.md`, then `/setup`.

## Boundaries — don't engineer around these

- Call only the public partner API: `https://api.sandbox.lithoshealth.com/v1/...`.
  M2M client-credentials only, minted server-side. The client id and secret must
  never reach the browser.
- **Sandbox only, obviously fake patients only.** `src/lib/journey.ts` and
  `src/lib/join.ts` enforce Sample/Test names, `example.com` emails and 555
  phones; `src/lib/setup/steps.ts` refuses any non-sandbox base URL. Keep all of
  those guards.
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
  `events/` (event store), `setup/` (the walkthrough).
- **Two route groups, two kinds of chrome.** `src/app/(site)/` is the patient-facing
  app; `src/app/(dev)/` is the developer walkthrough. The root layout is only the
  document shell. Route groups don't change URLs.
- **The setup walkthrough derives every step from a live API call.** Never mark a
  step done from local state alone — that's what makes it trustworthy.
- **Webhooks are thin.** An event carries a type and a `resource_id`; re-read the
  resource with a `GET` and store that. Never treat a payload as state.
- **The event store:** Postgres when `DATABASE_URL` is set, Upstash Redis when
  deployed without it, in-memory locally. The deployed app refuses to fall back
  to process memory.

## Routes

| Route | Audience | Purpose |
|---|---|---|
| `/setup` | developer | the walkthrough — credentials to a verified webhook |
| `/` | patient | marketing landing (membership first, care as the escalation) |
| `/start` | patient | direct intake → patient, care plan, encounter |
| `/care/[encounterId]` | patient | plain-language care status |
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
