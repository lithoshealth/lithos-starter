import "server-only";
import { createHash } from "node:crypto";

/**
 * The cookie value that means "set up" — for this connection only. Tagged
 * with a hash of the client ID (never the ID itself: it stays on the server),
 * so connecting with other credentials, after `npm run reset` or with a new
 * sandbox, brings the pop-up back instead of skipping "Make it yours".
 */
export function onboardingDoneValue(): string {
  const tag = createHash("sha256").update(process.env.LITHOS_CLIENT_ID ?? "").digest("hex").slice(0, 12);
  return `done:${tag}`;
}
