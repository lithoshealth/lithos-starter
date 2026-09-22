/**
 * Write one value into .env.local — development only.
 *
 * Lithos shows a webhook signing secret exactly once. Asking a person to copy
 * it from a web page into a file is exactly where it gets lost (it happened on
 * the first walkthrough), and a lost secret means registering the endpoint
 * again. So in development the app saves it for them, the same way
 * `npm run setup` saves credentials. On a deployed copy there is no file to
 * write — the host's environment settings are the only place — so this refuses
 * and the page shows the line to paste instead.
 */

import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function saveToEnvLocal(name: string, value: string): Promise<boolean> {
  if (process.env.NODE_ENV !== "development") return false;
  const file = path.join(process.cwd(), ".env.local");
  try {
    let text = "";
    try {
      text = await readFile(file, "utf8");
    } catch {
      /* no file yet — create it */
    }
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^${name}=.*$`, "m");
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\n*$/, text ? "\n" : "")}${line}\n`;
    await writeFile(file, text);
    await chmod(file, 0o600);
    return true;
  } catch {
    return false;
  }
}
