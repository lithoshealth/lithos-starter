import { notFound } from "next/navigation";
import { connectedOutsideSandbox } from "./lithos/sandbox";

/**
 * The ops pages — journeys, members, the webhook log, raw encounters — have no
 * login of their own. On the sandbox that's fine (fake patients); connected
 * anywhere else they'd show real records to anyone with the URL, so they're
 * not found. Put them behind your staff login before you lift this.
 */
export function sandboxOpsOnly(): void {
  if (connectedOutsideSandbox()) notFound();
}
