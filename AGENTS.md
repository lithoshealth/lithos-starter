# Lithos Starter — for coding agents

## Helping someone try the starter for the first time

The first run is the product demo, so leave the discovering to the person:

1. Clone, `npm install`, `npm run dev`.
2. Open **http://localhost:3001** — the home page, not `/setup` — and hand over.
   Tell them the app runs unconnected, that they can look around and submit a
   form, and that **Open the setup walkthrough** in the bar at the top of every
   page connects it to Lithos when they're ready. Then stop.

Don't open `/setup`, walk the intake, or tour the app on their behalf unless
they ask. Never enter their client ID or secret — step 1 of `/setup` has a
form for that. Once they've connected, help with whatever they ask.

The rest of the rules for working in this repo — sandbox-only, fake patients
only, secrets only in env vars — are in `CLAUDE.md`. Read it before changing code.
