import "server-only";
import { getLithosClient } from "@/lib/lithos/client";

/**
 * Where this app stands on the Lithos console's sandbox checklist, read live
 * from the API with this app's own credentials: a patient with your user ID,
 * an intake (encounter), a clinician's decision, and a webhook your endpoint
 * answered. The console asks the same four questions, so the two agree.
 *
 * Patients the console's own walkthrough made ("Sample Demo", user IDs that
 * start lithos_demo_) prove nothing about this app, so they're left out —
 * the console leaves them out too.
 */

export type DevCheck = { key: "patient" | "intake" | "decision" | "webhook"; label: string; done: boolean };
export type DevProgress = {
  checks: DevCheck[];
  next: { label: string; href: string; external?: boolean };
  // After a decision, the optional step: play the pharmacy in the patient app.
  pharmacy?: { href: string };
};

type Row = { id: string; patient_id?: string; status?: string; external_id?: string | null };

const DEMO_PREFIX = "lithos_demo_";
export const CONSOLE_URL = process.env.LITHOS_CONSOLE_URL || "https://app-sandbox.lithoshealth.com/launch";

/** Lithos refused this app's client ID and secret — typically because the sandbox organization they belong to was archived. */
export type CredentialsRejected = { rejected: true };

export async function readDevProgress(): Promise<DevProgress | CredentialsRejected | null> {
  const client = getLithosClient();
  try {
    const [patients, encounters, decided, endpoints, orders] = await Promise.all([
      client.get<{ data: Row[] }>("/v1/patients?limit=50"),
      client.get<{ data: Row[] }>("/v1/encounters?limit=50"),
      client.get<{ data: Row[] }>("/v1/encounters?limit=50&status=completed"),
      client.get<{ data: Array<{ status: string; last_success_at: string | null }> }>("/v1/webhook_endpoints"),
      client.get<{ data: Row[] }>("/v1/orders?limit=25"),
    ]);
    const demo = new Set(patients.data.filter((p) => p.external_id?.startsWith(DEMO_PREFIX)).map((p) => p.id));
    const ours = <T extends Row>(rows: T[]) => rows.filter((r) => !r.patient_id || !demo.has(r.patient_id));
    const patient = patients.data.some((p) => p.external_id && !demo.has(p.id));
    const intake = ours(encounters.data).length > 0;
    const decision = ours(decided.data).length > 0;
    const webhook = endpoints.data.some((e) => Boolean(e.last_success_at));
    const open = ours(encounters.data).find((e) => ["pending_review", "in_review", "escalated"].includes(e.status ?? ""));
    const openOrder = ours(orders.data).find((o) => ["pending", "processing", "placed"].includes(o.status ?? ""));

    const next: DevProgress["next"] =
      !patient || !intake
        ? { label: "Request care as a patient", href: "/start" }
        : !decision
          ? open
            ? { label: "Play the clinician", href: `/care/${encodeURIComponent(open.id)}` }
            : { label: "Request care as a patient", href: "/start" }
          : !webhook
            ? { label: "Set up webhooks", href: "/setup#webhooks" }
            : { label: "All four done: open your Lithos console", href: CONSOLE_URL, external: true };

    return {
      checks: [
        { key: "patient", label: "Patient", done: patient },
        { key: "intake", label: "Intake", done: intake },
        { key: "decision", label: "Decision", done: decision },
        { key: "webhook", label: "Webhook", done: webhook },
      ],
      next,
      pharmacy: decision && openOrder ? { href: "/portal" } : undefined,
    };
  } catch (error) {
    // The token mint answers 400/401 for a client it doesn't know. Say so,
    // rather than look connected while every page quietly falls back.
    if (error instanceof Error && /token mint failed with status 40[01]/.test(error.message)) return { rejected: true };
    return null;
  }
}
