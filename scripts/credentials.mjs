#!/usr/bin/env node
// Prints this app's Lithos credentials from .env.local, to paste into a
// 1Password item after a demo. The prospect pastes the client ID and secret
// into step 1 of /setup in the app you send them. The setup page never shows
// the full secret; this is the one place it's printed, on your own machine.
import { readFileSync } from "node:fs";

let text;
try {
  text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
} catch {
  console.error("No .env.local here — connect the app in step 1 of /setup first.");
  process.exit(1);
}

const env = Object.fromEntries(
  text.split("\n")
    .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, "")]),
);
const wanted = ["LITHOS_CLIENT_ID", "LITHOS_CLIENT_SECRET", "LITHOS_API_BASE_URL", "LITHOS_TOKEN_URL"];
if (!env.LITHOS_CLIENT_ID || !env.LITHOS_CLIENT_SECRET) {
  console.error("No LITHOS_CLIENT_ID / LITHOS_CLIENT_SECRET in .env.local — connect the app in step 1 of /setup first.");
  process.exit(1);
}

console.log("Lithos sandbox credentials — paste into a 1Password item and share it with the prospect.");
console.log("They paste the client ID and secret into step 1 of /setup in the app you send them.\n");
for (const key of wanted) if (env[key]) console.log(`${key}=${env[key]}`);
