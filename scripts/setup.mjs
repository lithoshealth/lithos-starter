#!/usr/bin/env node
// Connect this app to your Lithos sandbox.
//
//   npm run setup
//
// Asks for your client id and secret, writes them to .env.local, and checks
// them against Lithos straight away — so you find out now, not three steps
// into the walkthrough. The secret is never echoed or printed.
//
// Non-interactive (CI): set LITHOS_CLIENT_ID and LITHOS_CLIENT_SECRET in the
// environment and it uses those without asking. Don't pass the secret as a
// command-line argument: it would land in your shell history.

import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

const ENV_FILE = ".env.local";
const TEMPLATE = ".env.example";
const DEFAULTS = {
  LITHOS_API_BASE_URL: "https://api.sandbox.lithoshealth.com",
  LITHOS_TOKEN_URL: "https://api.sandbox.lithoshealth.com/v1/oauth2/token",
};

const bold = (s) => (stdout.isTTY ? `\x1b[1m${s}\x1b[22m` : s);
const green = (s) => (stdout.isTTY ? `\x1b[32m${s}\x1b[39m` : s);
const red = (s) => (stdout.isTTY ? `\x1b[31m${s}\x1b[39m` : s);
const dim = (s) => (stdout.isTTY ? `\x1b[2m${s}\x1b[22m` : s);

// ---------------------------------------------------------------- .env handling

function readEnvFile() {
  const source = existsSync(ENV_FILE) ? ENV_FILE : TEMPLATE;
  return { source, text: existsSync(source) ? readFileSync(source, "utf8") : "" };
}

function currentValue(text, name) {
  const match = text.match(new RegExp(`^${name}=(.*)$`, "m"));
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
}

/** Set a variable in place, keeping the file's comments and order; append it if absent. */
function setValue(text, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  return pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\n*$/, "\n")}${line}\n`;
}

// ---------------------------------------------------------------- prompts

const lines = createInterface({ input: stdin, terminal: false });
const queue = [];
const waiting = [];
lines.on("line", (line) => (waiting.length ? waiting.shift()(line) : queue.push(line)));
lines.on("close", () => waiting.splice(0).forEach((resolve) => resolve("")));

function readLine() {
  return queue.length ? Promise.resolve(queue.shift()) : new Promise((resolve) => waiting.push(resolve));
}

async function ask(question) {
  stdout.write(question);
  return (await readLine()).trim();
}

/** Read a secret without echoing it. Falls back to plain input when stdin isn't a terminal. */
async function askSecret(question) {
  if (!stdin.isTTY) return ask(question);
  stdout.write(question);
  // Detach the line reader first, or it would buffer every keystroke of the
  // secret alongside us. The secret is always the last question asked.
  lines.close();
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.off("data", onData);
          stdout.write("\n");
          stdin.pause();
          return resolve(value.trim());
        }
        if (char === "\u0003") { stdout.write("\n"); process.exit(130); } // Ctrl-C
        if (char === "\u007f" || char === "\b") { if (value.length) { value = value.slice(0, -1); stdout.write("\b \b"); } continue; }
        value += char;
        stdout.write("•");
      }
    };
    stdin.on("data", onData);
  });
}

// ---------------------------------------------------------------- the check

async function check(env) {
  let token;
  try {
    const response = await fetch(env.LITHOS_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: env.LITHOS_CLIENT_ID, client_secret: env.LITHOS_CLIENT_SECRET }),
    });
    if (!response.ok) {
      return { ok: false, why: `Lithos rejected these credentials (HTTP ${response.status}). Check for a stray space or a truncated paste — the secret is long.` };
    }
    token = (await response.json()).access_token;
  } catch (error) {
    return { ok: false, why: `Couldn't reach ${env.LITHOS_TOKEN_URL} (${error.message}). Are you online?` };
  }

  const response = await fetch(`${env.LITHOS_API_BASE_URL}/v1/catalog_treatments`, { headers: { authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const codes = (body.errors ?? []).map((e) => e.code);
    return {
      ok: false,
      why: codes.includes("auth.org_not_provisioned")
        ? "The credentials are valid, but they aren't attached to a Lithos organization — usually because the client was created outside Lithos's provisioning. Send your Lithos contact this code: auth.org_not_provisioned."
        : `A token was issued, but the first API call failed (HTTP ${response.status}${codes.length ? `, ${codes.join(", ")}` : ""}).`,
    };
  }
  return { ok: true, treatments: body.data ?? [] };
}

// ---------------------------------------------------------------- main

async function main() {
  console.log(`\n${bold("Connect this app to your Lithos sandbox")}\n`);
  console.log("You need two values from Lithos: a client ID and a client secret. They're");
  console.log("issued when your sandbox organization is set up — the secret is shown once,");
  console.log("so it's in whatever Lithos sent you, or in your password manager.");
  console.log(dim("No credentials yet? Ask your Lithos contact for a sandbox organization.\n"));

  const { source, text } = readEnvFile();
  const existingId = currentValue(text, "LITHOS_CLIENT_ID");
  const existingSecret = currentValue(text, "LITHOS_CLIENT_SECRET");

  let clientId = process.env.LITHOS_CLIENT_ID ?? "";
  let clientSecret = process.env.LITHOS_CLIENT_SECRET ?? "";

  if (!clientId) {
    const hint = existingId ? dim(` [Enter to keep ${existingId.slice(0, 14)}…]`) : "";
    clientId = (await ask(`Client ID${hint}: `)) || existingId;
  }
  if (!clientSecret) {
    const hint = existingSecret ? dim(" [Enter to keep the current one]") : "";
    clientSecret = (await askSecret(`Client secret${hint}: `)) || existingSecret;
  }
  lines.close();

  if (!clientId || !clientSecret) {
    console.log(`\n${red("✗")} Both values are needed — nothing was written.\n`);
    process.exit(1);
  }
  if (!clientId.startsWith("client_")) {
    console.log(dim(`\n(Lithos client IDs usually start with "client_" — double-check you pasted the ID, not the secret.)`));
  }

  const env = {
    LITHOS_API_BASE_URL: currentValue(text, "LITHOS_API_BASE_URL") || DEFAULTS.LITHOS_API_BASE_URL,
    LITHOS_TOKEN_URL: currentValue(text, "LITHOS_TOKEN_URL") || DEFAULTS.LITHOS_TOKEN_URL,
    LITHOS_CLIENT_ID: clientId,
    LITHOS_CLIENT_SECRET: clientSecret,
  };

  process.stdout.write("\nChecking them with Lithos… ");
  const result = await check(env);

  // Written either way, so a near-miss can be fixed by editing .env.local rather
  // than re-typing both — but the outcome is stated plainly.
  let updated = text;
  for (const [name, value] of Object.entries(env)) updated = setValue(updated, name, value);
  writeFileSync(ENV_FILE, updated);
  chmodSync(ENV_FILE, 0o600);

  if (!result.ok) {
    console.log(`${red("✗")}\n\n${result.why}\n`);
    console.log(dim(`Saved to ${ENV_FILE} anyway (from ${source}) — fix it there, or run npm run setup again.\n`));
    process.exit(1);
  }

  // The same three checks as step 1 of /setup, so the terminal and the page tell one story.
  const lipid = result.treatments.filter((t) => t.categories?.includes("lipid_management")).map((t) => t.name);
  const count = `${result.treatments.length} treatment${result.treatments.length === 1 ? "" : "s"}`;
  console.log(green("✓ connected"));
  console.log(`\n  ${green("✓")} Credentials in ${ENV_FILE} ${dim("(gitignored, readable only by you)")}`);
  console.log(`  ${green("✓")} Access token minted`);
  console.log(`  ${green("✓")} Your organization's formulary read — ${count}${lipid.length ? `, lipid: ${lipid.join(", ")}` : ""}\n`);
  console.log(`Step 1 of the walkthrough is done. Next: ${bold("http://localhost:3001/setup")} ${dim("— run npm run dev first if it isn't already running.")}\n`);
}

main().catch((error) => {
  console.error(`\n${red("✗")} ${error.message}\n`);
  process.exit(1);
});
