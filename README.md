# Lithos Starter

A working partner app on the Lithos sandbox — clone it, add your credentials, and
reach your first encounter in about fifteen minutes.

It wears a demo brand, **Eucardia Health**: a fictional cardiometabolic
membership that adds prescribing through Lithos. Nothing in the integration
depends on the brand. The **Make it yours** panel at the top of `/setup` changes the
name, tagline, colour and logo live, saving them to `starter.config.json` (and the
logo to `public/brand/`), so they're committed with your code. The longer marketing
copy on the patient-facing pages is yours to replace.

> **Sandbox only.** This app refuses to create patients anywhere but
> `api.sandbox.lithoshealth.com`, and rejects anything that isn't obviously fake
> patient data (Sample/Test names, `example.com` emails, 555 phone numbers).

## Quick start

You need Node 20+. Sandbox credentials — a **client ID** (it starts with
`client_`) and a **client secret** — you can get from the app itself: step 1 of
the walkthrough creates a sandbox organization from your email and company name
and saves its credentials for you. Already have a pair from Lithos? Paste it
instead.

**Use a separate sandbox organization for this starter** — not the one you'll build
your own integration on. An organization has one webhook endpoint and one shared
set of patients: run both apps on the same credentials and only one of them
receives webhooks, and the starter's sample patients mix into the organization
you build on. Getting credentials in step 1 always creates a new organization,
so each app can have its own.

```sh
git clone https://github.com/lithoshealth/lithos-starter.git
cd lithos-starter
npm install
npm run dev
```

Then open **http://localhost:3001** and look around the app first — it runs
unconnected, and a form you submit will tell you what's missing rather than
break. When you're ready, click **Open the setup walkthrough** in the bar at the top of any page:
step 1 gets you sandbox credentials (or takes the ones you have), checks them
with Lithos, and saves them to `.env.local` (gitignored). Prefer the terminal?
`npm run setup` takes a pasted pair before you start the server.

## The setup walkthrough

`/setup` takes you from credentials to a clinician's decision in four steps, with a fifth, optional:

1. Connect to Lithos — get sandbox credentials or paste yours, checked by minting a token and reading your formulary
2. Choose what you offer — lipid management or weight loss. It switches the whole site: home page copy, the care-review intake, and the protocol a clinician reviews against (saved to `starter.config.json`)
3. Onboard your first patient — choose quiz or chat, then fill in the intake yourself, right in the page. Sending it creates the patient, a care plan and an encounter (or use the sample-patient shortcut)
4. Play the clinician — an illustrative review of the intake, then approve, decline, or ask the patient a question (sandbox helpers)
5. *Optional:* stay in step with your patients' care — webhooks. Lithos posts an event whenever something happens; the app shows a feed of what it heard and a care-team inbox for the clinician's questions, where you relay the patient's reply. Setting it up needs a public HTTPS address for the app (a tunnel or a deployment)

Every step is checked against the live API — nothing is ticked by hand, so if you
do a step your own way (curl, your own code), it still turns green. Each one shows
the exact request it sends, what Lithos returned, and the file that made the call.
When something's wrong, it tells you what and how to fix it.

**Webhooks need a public HTTPS URL** — Lithos can't deliver to localhost. Either
deploy the app, or run a tunnel and register its URL:

```sh
cloudflared tunnel --url http://localhost:3001
```

The tunnel is only for Lithos to reach you — keep browsing on `localhost`.

Deploying to Vercel? Turn **Deployment Protection** off for production. It's on
by default for new projects, and it answers Lithos's deliveries with a `401` that
looks exactly like a signature failure. `/setup` will tell you if this is what's
happening.

## API reference

The walkthrough covers the path to a first prescription. The full API — every
endpoint, field, error code and webhook event — is documented at
**https://docs.lithoshealth.com**.

## Where things live

| Path | What it is |
|---|---|
| `src/lib/lithos/` | The API client: token minting and caching, requests, the `errors[]` envelope, types, the sandbox-only guard, and idempotency keys — every create is sent with one, so a double click or a retried request makes one record, not two |
| `src/lib/webhooks/` | Signature verification (HMAC-SHA256 over `"<t>.<raw body>"`) and the delivery handler |
| `src/lib/notifications/` | Telling the patient when a webhook is theirs to know — the care team wrote, the order shipped, a visit moved. Content-free by design (email isn't a secure channel): it says something is waiting and links into the app. Goes to the outbox on `/events` until you set `RESEND_API_KEY` and `NOTIFY_FROM_EMAIL`; another channel is one more `Notifier` |
| `src/app/api/webhooks/lithos/` | The webhook receiver |
| `src/lib/setup/` | The walkthrough: step checks and the exact request bodies it sends |
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

Worth reading once you've done the walkthrough:

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
walkthrough needs (or edit `.env.local` by hand); `LITHOS_WEBHOOK_SECRET` comes from step 5 (it's saved for you in development); everything else is for
the membership side or for deploying.

```sh
npm run lint
npm run typecheck
npm test
```

## License

MIT, see [`LICENSE`](LICENSE). Your use of the Lithos sandbox and API is
governed separately by the [Lithos Platform Terms](https://app-sandbox.lithoshealth.com/legal/platform-terms).
