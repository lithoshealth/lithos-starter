# Lithos Starter

A working partner app on the Lithos sandbox — clone it, add your credentials, and
reach your first encounter in about fifteen minutes.

It wears a demo brand, **Eucardia Health**: a fictional cardiometabolic
membership that adds prescribing through Lithos. Nothing in the integration
depends on the brand. The **Make it yours** panel (in the first-run pop-up, and on
`/setup`, the Developer page) changes the
name, tagline, colour and logo live, saving them to `starter.config.json` (and the
logo to `public/brand/`), so they're committed with your code. The longer marketing
copy on the patient-facing pages is yours to replace.

> **Sandbox only.** This app refuses to create patients anywhere but
> `api.sandbox.lithoshealth.com`, and rejects anything that isn't obviously fake
> patient data (Sample/Test names, `example.com` emails, 555 phone numbers).

## Quick start

You need Node 20+, and sandbox credentials: a **client ID** (it starts with
`client_`) and a **client secret**. If this starter is your app, use the pair from
your Lithos console, so its sandbox checklist ticks as the app makes the calls.
Just trying it next to your own app? The first-run pop-up can make a new sandbox
organization instead: an organization has one webhook endpoint and one shared set
of patients, so two apps shouldn't share one.

```sh
git clone https://github.com/lithoshealth/lithos-starter.git
cd lithos-starter
npm install
npm run dev
```

It opens **http://localhost:3001** in your browser (set `BROWSER=none` to skip that),
with a pop-up to connect: paste your client ID and secret (checked with Lithos, then
saved to `.env.local`, which git ignores) and make the app yours. There's no program to
pick: the app offers the protocols your organization chose in the Lithos console, and
with more than one, `/start` asks the patient which they want. "Look around first" closes it; the bar at the top brings it back. Prefer
the terminal? `npm run setup` takes a pasted pair before you start the server.

To start over — a first run again, for a new sandbox or the next demo — stop the
server and run `npm run reset`: it disconnects (keeping the old `.env.local` as a
backup), puts the brand back, clears the program and empties the local database.
Your sandbox organization at Lithos keeps what it has; connect a new sandbox for a
checklist that starts empty.

## Trying the journey

There's no walkthrough to follow: the app is the walkthrough. The bar at the top of
every page shows your Lithos console's sandbox checklist, live, and what to do next:

1. **Request care as a patient** at `/start`: the real intake (a quiz or a chat).
   Sending it creates the patient, a care plan and an encounter.
2. **Play the clinician** on the patient's care page: approve, decline, or ask the
   patient a question. Sandbox only; in production a Lithos clinician decides.
3. *Optional:* **play the pharmacy** in the patient app (**Sign in** in the header),
   where demo controls move the order to delivered.
4. **Receive a webhook**: set up on `/setup`, the Developer page, with a test event
   to check it.

Each check is read from the live API, so doing a step your own way (curl, your own
code) ticks it too.

**Webhooks need a public HTTPS URL** — Lithos can't deliver to localhost. Either
deploy the app, or run a tunnel and register its URL:

```sh
cloudflared tunnel --url http://localhost:3001
```

The tunnel is only for Lithos to reach you — keep browsing on `localhost`.

Deploying to Vercel? Turn **Deployment Protection** off for production. It's on
by default for new projects, and it answers Lithos's deliveries with a `401` that
looks exactly like a signature failure. The Developer page (`/setup`) will tell you if this is what's
happening.

## API reference

The app covers the path to a first prescription. The full API — every
endpoint, field, error code and webhook event — is documented at
**https://docs.lithoshealth.com**.

## Where things live

| Path | What it is |
|---|---|
| `src/lib/lithos/` | The API client: token minting and caching, requests, the `errors[]` envelope, types, the sandbox-only guard, and idempotency keys — every create is sent with one, so a double click or a retried request makes one record, not two |
| `src/lib/webhooks/` | Signature verification (HMAC-SHA256 over `"<t>.<raw body>"`) and the delivery handler |
| `src/lib/notifications/` | Telling the patient when a webhook is theirs to know — the care team wrote, the order shipped, a visit moved. Content-free by design (email isn't a secure channel): it says something is waiting and links into the app. Goes to the outbox on `/events` until you set `RESEND_API_KEY` and `NOTIFY_FROM_EMAIL`; another channel is one more `Notifier` |
| `src/app/api/webhooks/lithos/` | The webhook receiver |
| `src/lib/setup/` | The Developer page's checks (connection, program, webhooks), and connecting from the app |
| `src/lib/dev-progress.ts` | The sandbox checklist in the top bar, read live from the API |
| `src/lib/journey.ts`, `src/app/start/` | A direct intake form: patient → care plan → encounter in one submission |
| `src/lib/escalate.ts`, `src/lib/escalation.ts` | Escalating an existing member into care — **illustrative rules, see below** |
| `src/lib/portal/`, `src/app/(portal)/` | The patient's app (**Sign in** in the header): Home (the prescription, its pharmacy and delivery, the plan), Messages (a chat with the care team) and Support, read live from Lithos. Lithos has no patient logins — your app owns them — so a demo sign-in stands in: it picks someone from your own records, and their Lithos patient is the link on that record. Everyone who asks for care — through the care review, the walkthrough, or as a member — is one row in your records and one Lithos patient, whichever door they came in by. The plan's coaching steps and the support answers are your program's content (`journey.ts`, `support.ts`), illustrative. On a local sandbox copy, demo controls play the clinician, the pharmacy and the care team |

## Going further: a partner with its own members

The rest of the app shows what a partner that already has users looks like —
members who exist in your own records before Lithos ever sees them, with a
membership signup (`/join`), a member dashboard, and escalation into care.

That side keeps its records in Postgres, and there's nothing to install for it:
with no `DATABASE_URL`, `npm run dev` runs Postgres itself — PGlite, real Postgres
inside Node — keeping its data in `.lithos-db/` (never committed, never in the
downloaded zip) and seeding sample members on the first start. The scripts
(`npm run db:seed`, `npm run replay`, …) use it while the app is running. A
deployed app needs a hosted Postgres: set `DATABASE_URL`. `./scripts/db-up.sh`
still sets up a Homebrew or Docker Postgres if you'd rather run your own; with
`DATABASE_URL` set, `npm run dev` brings it up to `db/schema.sql` on every start.

Worth reading once you've tried the journey:

- **`external_id` is your reconciliation key.** Send your own member id when you
  create a patient; Lithos stores it immutably, and a reused one returns the
  existing patient's id instead of creating a duplicate.
- **Webhooks carry a type and a resource id, not state.** On every event, re-read
  the resource with a `GET` and store that. `scripts/replay-deliveries.mjs`
  recovers from an outage using the delivery log.

## Eligibility rules are illustrative

`src/lib/escalation.ts` screens members before escalating them, against a draft
of the lipid management protocol. **It is an example of the kind of screening a
partner does — not Lithos's clinical criteria.** Get the current protocol for
your programs from your Lithos contact before relying on any rule in it.

## Taking it to production

This starter is built for the sandbox, and it protects itself there. Pointed at
any other Lithos API, the API client refuses to run until you set
`LITHOS_ALLOW_NON_SANDBOX=1` — a deliberate step, not a credentials swap. Even
then, the demo conveniences stay off outside the sandbox: the patient app's
sign-in list (anyone could pick any patient), the ops pages (`/journeys`,
`/members`, `/events`, `/status`), and the demo controls.

What's yours to build before real patients:

- **Your login.** Patients: replace `src/lib/portal/session.ts` with your own
  sign-in, mapping each user to their Lithos patient ID (you'll keep that
  mapping in your database). Staff: put the ops pages behind it, then lift
  `src/lib/ops-guard.ts`.
- **Hosting and compliance.** HIPAA-ready hosting with a BAA, audit logging,
  session security, and no patient data in logs.
- **Running it.** Monitoring and alerts on webhook deliveries (the
  `/events` page shows what this app heard; Lithos's delivery log shows what it
  sent), rate limiting on your forms, backups of your own database.
- **Your content.** The eligibility rules in `src/lib/escalation.ts`, the
  plan's steps in `src/lib/portal/journey.ts` and the support answers in
  `src/lib/portal/support.ts` are illustrative. Replace them with yours.

## Environment

See `.env.example`. `npm run setup` fills in the four `LITHOS_` values the
app needs (or edit `.env.local` by hand); `LITHOS_WEBHOOK_SECRET` comes from registering your webhook endpoint on the Developer page (it's saved for you in development); everything else is for
the membership side or for deploying.

```sh
npm run lint
npm run typecheck
npm test
```

## License

MIT, see [`LICENSE`](LICENSE). Your use of the Lithos sandbox and API is
governed separately by the [Lithos Platform Terms](https://app-sandbox.lithoshealth.com/legal/platform-terms).
