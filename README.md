# Lithos Starter

A working partner app on the Lithos sandbox — clone it, add your credentials, and
reach your first encounter in about fifteen minutes.

It wears a demo brand, **Eucardia Health**: a fictional cardiometabolic
membership that adds prescribing through Lithos. Nothing in the integration
depends on the brand: `NEXT_PUBLIC_APP_NAME` renames the header and page titles,
and the marketing copy on the patient-facing pages is yours to replace.

> **Sandbox only.** This app refuses to create patients anywhere but
> `api.sandbox.lithoshealth.com`, and rejects anything that isn't obviously fake
> patient data (Sample/Test names, `example.com` emails, 555 phone numbers).

## Quick start

You need Node 20+ and Lithos sandbox credentials: a **client ID** (it starts with
`client_`) and a **client secret**, issued when Lithos sets up your sandbox
organization. The secret is shown once, so it's in whatever Lithos sent you. No
credentials yet? Ask your Lithos contact for a sandbox organization.

```sh
git clone https://github.com/lithoshealth/lithos-starter.git
cd lithos-starter
npm install
npm run setup    # paste your client ID and secret; it checks them with Lithos
npm run dev
```

Then open **http://localhost:3001/setup** — in development, every page of the app
also has a link to it at the top.

## The setup walkthrough

`/setup` takes you from credentials to a verified webhook in six steps:

1. Connect to Lithos — your credentials, checked by minting a token and reading your formulary
2. Create a patient
3. Create a care plan and an encounter
4. Sign the encounter off as the clinician (a sandbox helper)
5. Register a webhook endpoint
6. Receive a verified webhook

Every step is checked against the live API — nothing is ticked by hand, so if you
do a step your own way (curl, your own code), it still turns green. Each one shows
the exact request it sends, what Lithos returned, and the file that made the call.
When something's wrong, it tells you what and how to fix it.

**Webhooks need a public HTTPS URL** — Lithos can't deliver to localhost. Either
deploy the app, or run a tunnel and register its URL:

```sh
cloudflared tunnel --url http://localhost:3001
```

Deploying to Vercel? Turn **Deployment Protection** off for production. It's on
by default for new projects, and it answers Lithos's deliveries with a `401` that
looks exactly like a signature failure. `/setup` will tell you if this is what's
happening.

## Where things live

| Path | What it is |
|---|---|
| `src/lib/lithos/` | The API client: token minting and caching, requests, the `errors[]` envelope, types |
| `src/lib/webhooks/` | Signature verification (HMAC-SHA256 over `"<t>.<raw body>"`) and the delivery handler |
| `src/app/api/webhooks/lithos/` | The webhook receiver |
| `src/lib/setup/` | The walkthrough: step checks and the exact request bodies it sends |
| `src/lib/journey.ts`, `src/app/start/` | A direct intake form: patient → care plan → encounter in one submission |
| `src/lib/escalate.ts`, `src/lib/escalation.ts` | Escalating an existing member into care — **illustrative rules, see below** |

## Going further: a partner with its own members

The walkthrough needs no database. The rest of the app shows what a partner that
already has users looks like — members who exist in your own records before
Lithos ever sees them, with a membership signup (`/join`), a member dashboard, and
escalation into care. That side needs Postgres:

```sh
./scripts/db-up.sh    # Homebrew Postgres or Docker, then schema + sample members
```

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

## Environment

See `.env.example`. `npm run setup` fills in the four `LITHOS_` values the
walkthrough needs (or edit `.env.local` by hand); `LITHOS_WEBHOOK_SECRET` comes from step 5; everything else is for
the membership side or for deploying.

```sh
npm run lint
npm run typecheck
npm test
```
