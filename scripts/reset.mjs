// npm run reset — put this copy back to a first run, so the connect pop-up,
// the program picker and "Make it yours" show again. For trying the starter
// as a new customer would, or giving the demo twice.
//
//   - .env.local: the client ID, secret and signup email are cleared. The old
//     file is kept as .env.reset-<time>.local (gitignored) — nothing is lost.
//   - starter.config.json: back to the Eucardia brand, no program chosen.
//   - public/brand/: an uploaded logo is removed.
//   - .lithos-db/ (the embedded database: members, journeys, webhook log):
//     emptied too, but only while the app isn't running — stop `npm run dev`
//     first, or it's left as it is.
//
// What it can't reset: what your sandbox organization at Lithos already holds.
// The checklist in the top bar reads it from the API, so reconnecting with the
// same credentials ticks the same steps. For a clean slate, create a new
// sandbox in the Lithos console and connect with its credentials.
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { databaseUrl } from "../db/running.mjs";

const root = process.cwd();
const done = [];

// ---- credentials
const envPath = path.join(root, ".env.local");
const CLEARED = ["LITHOS_CLIENT_ID", "LITHOS_CLIENT_SECRET", "LITHOS_SIGNUP_EMAIL"];
if (existsSync(envPath)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = `.env.reset-${stamp}.local`;
  copyFileSync(envPath, path.join(root, backup));
  const lines = readFileSync(envPath, "utf8").split("\n").map((line) => {
    const name = line.split("=")[0]?.trim();
    return CLEARED.includes(name) ? `${name}=` : line;
  });
  writeFileSync(envPath, lines.join("\n"));
  done.push(`Disconnected from Lithos (old .env.local kept as ${backup})`);
}

// ---- brand and program
const configPath = path.join(root, "starter.config.json");
writeFileSync(configPath, JSON.stringify({
  brand: { name: "Eucardia Health", tagline: "Good heart.", color: "#1e5e59" },
  intakeStyle: "quiz",
}, null, 2) + "\n");
done.push("Brand back to Eucardia Health, no program chosen");

const brandDir = path.join(root, "public", "brand");
if (existsSync(brandDir)) {
  const logos = readdirSync(brandDir).filter((f) => /^logo\.(png|jpe?g|webp)$/.test(f));
  logos.forEach((f) => rmSync(path.join(brandDir, f)));
  if (logos.length > 0) done.push("Uploaded logo removed");
}

// ---- local database
const dbDir = path.join(root, ".lithos-db");
if (process.env.DATABASE_URL) {
  done.push("Database left alone (DATABASE_URL is set — it isn't this copy's to empty)");
} else if (databaseUrl(root)) {
  done.push("Database left alone: the app is running. Stop npm run dev and run this again to empty it too");
} else if (existsSync(dbDir)) {
  rmSync(dbDir, { recursive: true, force: true });
  done.push("Local database emptied (members, journeys, webhook log)");
}

console.log(done.map((line) => `  ✓ ${line}`).join("\n"));
console.log(`
Next: npm run dev, then open http://localhost:3001 in a private window
(the pop-up remembers "look around first" for the rest of a browser session).
Your sandbox organization at Lithos still has its patients and webhooks: for
a checklist that starts empty, create a new sandbox in the Lithos console and
connect with its credentials.`);
