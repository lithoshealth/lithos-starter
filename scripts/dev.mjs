#!/usr/bin/env node
// `npm run dev`: the Next.js dev server on port 3001, and the home page opened
// in your browser once it answers — not /setup: the app is meant to be looked
// around before it's connected. Set BROWSER=none (or run in CI) to skip the
// browser. Any extra arguments go to `next dev`.
import { spawn } from "node:child_process";

const port = 3001;
const url = `http://localhost:${port}`;

const server = spawn("npx", ["next", "dev", "-p", String(port), ...process.argv.slice(2)], { stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));

const skip = process.env.CI || process.env.BROWSER === "none";
if (!skip) {
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
}
