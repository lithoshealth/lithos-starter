import "server-only";
import { createHash } from "node:crypto";

/**
 * The cookie value that means "set up" — for this connection only. Tagged
 * with a hash of the client ID and when it was connected (never the ID
 * itself: it stays on the server), so connecting again — after `npm run reset`,
 * to a new sandbox, or with the same credentials — brings the pop-up back
 * instead of skipping "Make it yours".
 */
export function onboardingDoneValue(): string {
  const tag = createHash("sha256").update(`${process.env.LITHOS_CLIENT_ID ?? ""}|${process.env.LITHOS_CONNECTED_AT ?? ""}`).digest("hex").slice(0, 12);
  return `done:${tag}`;
}
