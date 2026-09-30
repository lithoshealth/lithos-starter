#!/usr/bin/env node
// A fresh copy of the starter for one prospect, ready to demo.
//
//   npm run demo -- "Acme Health"
//
// Makes its own folder next to this one (../lithos-demos/acme-health), named
// for the prospect and branded with their name, installs it, starts it and
// opens the browser. Every prospect gets their own folder because the brand,
// program and credentials live in it — and the folder is what you send them
// afterwards. Run the same command again to reopen a demo where you left it —
// updated to the latest starter, its brand kept.
//
// This copy stays clean: it's only the template the demos are made from.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { stdout } from "node:process";
import { fileURLToPath } from "node:url";

const bold = (s) => (stdout.isTTY ? `\x1b[1m${s}\x1b[22m` : s);
const red = (s) => (stdout.isTTY ? `\x1b[31m${s}\x1b[39m` : s);
const dim = (s) => (stdout.isTTY ? `\x1b[2m${s}\x1b[22m` : s);

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv.slice(2).join(" ").trim();
if (!name) {
  console.error(`Usage: ${bold('npm run demo -- "Acme Health"')}  — the prospect's company name.`);
  process.exit(1);
}
const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
if (!slug) {
  console.error(red(`"${name}" needs at least one letter or number to name its folder.`));
  process.exit(1);
}

// Demos sit side by side, whether this is run from the template or from a demo.
const parent = path.dirname(here);
const demos = path.basename(parent) === "lithos-demos" ? parent : path.join(parent, "lithos-demos");
const target = path.join(demos, slug);

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(red(`\n${command} ${args.join(" ")} failed.`));
    process.exit(result.status ?? 1);
  }
}

function git(args, cwd) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

let dependenciesChanged = false;
if (existsSync(target)) {
  console.log(`Reopening the ${bold(name)} demo — ${dim(target)}`);
  // Bring it up to the latest starter too. Its brand, program and logo are
  // local edits; --autostash carries them over the update.
  const before = git(["rev-parse", "HEAD"], target).stdout.trim();
  if (git(["pull", "--ff-only", "--autostash", "--quiet"], target).status !== 0) {
    console.log(dim("Couldn't update it from GitHub — opening it as it is."));
  }
  const after = git(["rev-parse", "HEAD"], target).stdout.trim();
  if (before && after !== before) {
    console.log("Updated to the latest starter.");
    dependenciesChanged = git(["diff", "--quiet", before, after, "--", "package-lock.json"], target).status !== 0;
  }
} else {
  // Start from the latest starter. Offline or ahead of GitHub? Use it as it is.
  if (git(["pull", "--ff-only", "--quiet"], here).status !== 0) {
    console.log(dim("Couldn't update from GitHub — making the demo from this copy as it is."));
  }
  console.log(`Making the ${bold(name)} demo — ${dim(target)}`);
  run("git", ["clone", "--quiet", here, target]);
  const origin = git(["remote", "get-url", "origin"], here).stdout.trim();
  if (origin) git(["remote", "set-url", "origin", origin], target);

  // Their name from the start; the rest is set live in "Make it yours".
  const configFile = path.join(target, "starter.config.json");
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  config.brand = { ...config.brand, name };
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
}

if (dependenciesChanged || !existsSync(path.join(target, "node_modules"))) {
  console.log("Installing — about half a minute, faster after the first demo.");
  run("npm", ["install", "--prefer-offline", "--no-audit", "--no-fund", "--loglevel=error"], target);
}

// 3001 unless another demo already has it.
function free(port) {
  return new Promise((resolve) => {
    const server = createServer().once("error", () => resolve(false));
    server.listen(port, () => server.close(() => resolve(true)));
  });
}
let port = 3001;
while (!(await free(port))) port += 1;
const url = `http://localhost:${port}`;

console.log(`
${bold(`${name} is starting at ${url}`)}
  On the call:  open the setup walkthrough from the bar at the top. In step 1, use
                the prospect's email and company name — that makes their own
                sandbox organization.
  If they say yes:  "Download app", then "Email app", at the bottom of the
                walkthrough. Add the zip to the draft with its Drive button
                (Gmail blocks it as an attachment), and send.
  Stop with Ctrl-C. ${bold(`npm run demo -- "${name}"`)} reopens it.
`);

const server = spawn("npx", ["next", "dev", "-p", String(port)], { cwd: target, stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));

// Open the home page — not /setup — once the server answers.
for (let tries = 0; tries < 120; tries += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  try {
    await fetch(url);
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    spawn(opener, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
    break;
  } catch {
    /* not up yet */
  }
}
