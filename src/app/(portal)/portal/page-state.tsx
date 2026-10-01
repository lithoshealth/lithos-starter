import { lithosConnection } from "@/lib/lithos/connection";
import { LithosApiError } from "@/lib/lithos/errors";
import { signedInPortal } from "@/lib/portal/load";
import type { PortalData } from "@/lib/portal/view";
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
  let data: PortalData | undefined;
  try {
    data = await signedInPortal();
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
  return data ? { kind: "ready", data } : { kind: "signed_out" };
}
