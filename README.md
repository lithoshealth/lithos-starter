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

### Running a sales demo

Keep one clone as the template and make a copy per prospect from it:

```sh
npm run demo -- "Acme Health"
```

It updates the template from GitHub, copies it to `../lithos-demos/acme-health`
with the prospect's name as the brand, installs it, starts it (on 3001, or the
next free port) and opens the home page. On the call, step 1 of the walkthrough
takes the prospect's email and company name and makes them their own sandbox
organization. Run the same command again to reopen that demo where you left it.

If they want to keep it, **Download your app** at the bottom of `/setup` zips the
app as you've made it — brand, program, intake, logo — with no credentials, and
a note of which patient the walkthrough was following. Send the credentials
separately, the way Lithos sends them: `npm run credentials`, in the demo's
folder, prints them to paste into a 1Password item. When the prospect opens the
app and pastes them into step 1, they're back where you left off: the same
organization, the same patient, the clinician's decision.

> **Setting this up with an AI coding agent?** Agents: stop at the home page.
> Run the commands above, open http://localhost:3001, and hand over — let the
> person look around and find the setup walkthrough themselves. Don't open `/setup`, walk
> the intake, or enter credentials for them unless they ask. More in `AGENTS.md`.

Browse on `localhost` (or `127.0.0.1`). The dev server only sends its JavaScript
to those, so opened any other way — your tunnel's address, or your laptop's
network address from a phone — pages render but nothing responds. A deployed
copy has no such limit.

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
walkthrough needs (or edit `.env.local` by hand); `LITHOS_WEBHOOK_SECRET` comes from step 5 (it's saved for you in development); everything else is for
the membership side or for deploying.

```sh
npm run lint
npm run typecheck
npm test
```
