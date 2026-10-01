import { lithosConnection } from "@/lib/lithos/connection";
import { LithosApiError } from "@/lib/lithos/errors";
import { signedInPortal } from "@/lib/portal/load";
import type { PortalData } from "@/lib/portal/view";
import Link from "next/link";
import { NotConnected } from "../../(site)/not-connected";
import { signOutAction } from "./actions";
import { PortalShell } from "./shell";

export type PageState =
  | { kind: "ready"; data: PortalData }
  | { kind: "signed_out" }
  | { kind: "screen"; screen: React.ReactNode };

/** What every tab needs first: a connection, a signed-in patient, and their record from Lithos. */
export async function portalPageState(): Promise<PageState> {
  if (!lithosConnection().connected) {
    return {
      kind: "screen",
      screen: (
        <PortalShell eyebrow="Your account" title="Not connected yet">
          <NotConnected action="This app shows a patient their care" outcome="it holds their record — the review, the prescription, the delivery" />
        </PortalShell>
      ),
    };
  }
  let signed: Awaited<ReturnType<typeof signedInPortal>>;
  try {
    signed = await signedInPortal();
  } catch (error) {
    if (!(error instanceof LithosApiError)) throw error;
    return {
      kind: "screen",
      screen: (
        <PortalShell eyebrow="Your account" title="We couldn’t load your account">
          <div className="error-box">
            <p className="muted">Lithos responded with HTTP {error.status}.</p>
            <ul>{error.errors.map((e, i) => <li key={`${e.code}-${i}`}>{e.message}{e.source?.pointer && <code className="muted"> {e.source.pointer}</code>}</li>)}</ul>
          </div>
          <form action={signOutAction}><button className="btn btn-ghost">Choose another patient</button></form>
        </PortalShell>
      ),
    };
  }
  if (!signed) return { kind: "signed_out" };
  if (signed.care) return { kind: "ready", data: signed.care };
  // In your records, but not a patient yet: nothing for Lithos to show.
  const first = signed.who.member?.firstName;
  return {
    kind: "screen",
    screen: (
      <PortalShell eyebrow="Your account" title={first ? `Hi ${first}` : "Welcome"} lede="You haven’t asked for care yet.">
        <div className="card-soft">
          <p><strong>Start with a care review</strong></p>
          <p className="muted">A few questions about your health. A licensed clinician reviews them, and your plan, prescription and messages show up here.</p>
          <p><Link href="/start" className="btn btn-primary">Start a care review</Link></p>
        </div>
        <form action={signOutAction}><button className="link-button">Switch person</button></form>
      </PortalShell>
    ),
  };
}
