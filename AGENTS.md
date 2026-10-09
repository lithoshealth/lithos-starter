# Lithos Starter — for coding agents

## Helping someone try the starter for the first time

The first run is the product demo, so leave the discovering to the person:

1. Clone (or unzip, if it was sent after a demo — `START-HERE.md` is then in the
   folder), `npm install`, `npm run dev`.
2. `npm run dev` opens **http://localhost:3001**, the home page, with a pop-up
   to connect to Lithos. Hand over there. Tell them the pop-up takes the client
   ID and secret from their Lithos console (or gets new sandbox credentials),
   then lets them make the app theirs, and that the bar at the top then shows
   their sandbox checklist and what to do next. Then stop.

Don't walk the intake, play the clinician or tour the app on their behalf
unless they ask. Never enter their client ID or secret: the pop-up has a form
for that. Once they've connected, help with whatever they ask.

The rest of the rules for working in this repo — sandbox-only, fake patients
only, secrets only in env vars — are in `CLAUDE.md`. Read it before changing code.
