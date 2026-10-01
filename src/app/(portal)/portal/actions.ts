"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLithosClient } from "@/lib/lithos/client";
import { LithosApiError } from "@/lib/lithos/errors";
import type { ApiError } from "@/lib/lithos/types";
import { readPortalPatientId, signInAs, signOut } from "@/lib/portal/session";
import { contentFor } from "@/lib/programs/content";
import { askPatientAsClinician, declineAsClinician, isSandboxBaseUrl, signOffAsClinician } from "@/lib/sandbox-review";
import { programFor } from "@/lib/setup/programs";

export type PortalActionState =
  | { status: "idle" }
  | { status: "done"; message?: string }
  | { status: "error"; httpStatus?: number; errors: ApiError[] };

const failed = (error: unknown): PortalActionState => {
  if (error instanceof LithosApiError) return { status: "error", httpStatus: error.status, errors: error.errors };
  if (error instanceof Error) return { status: "error", errors: [{ code: "portal.failed", message: error.message }] };
  throw error;
};

/** Demo sign-in: become one of the organization's sample patients. */
export async function signInAction(formData: FormData): Promise<void> {
  const patientId = String(formData.get("patient_id") ?? "");
  if (patientId) await signInAs(patientId);
  redirect("/portal");
}

/** Demo: back to the list of sample patients. */
export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/portal");
}

/** Sign out, as a patient would: back to the site's home page. */
export async function signOutToSiteAction(): Promise<void> {
  await signOut();
  redirect("/");
}

/**
 * The patient writes to the care team. Lithos can't reach the patient — the
 * partner's app relays what they write: into the open conversation, or as a
 * new one (`POST /v1/patients/{id}/inquiries`) when there isn't one.
 */
export async function sendMessageAction(_prev: PortalActionState, formData: FormData): Promise<PortalActionState> {
  const threadId = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { status: "error", errors: [{ code: "portal.empty_message", message: "Write your message first." }] };
  const patientId = await readPortalPatientId();
  if (!patientId) return { status: "error", errors: [{ code: "portal.signed_out", message: "Sign in again to send it." }] };

  const client = getLithosClient();
  try {
    if (threadId) {
      await client.post(`/v1/inquiries/${encodeURIComponent(threadId)}/messages`, { body });
    } else {
      const subject = body.length > 60 ? `${body.slice(0, 57).trimEnd()}…` : body;
      await client.post(`/v1/patients/${encodeURIComponent(patientId)}/inquiries`, { subject, message: { body } });
    }
  } catch (error) {
    return failed(error);
  }
  revalidatePath("/portal", "layout");
  return { status: "done" };
}

// ------------------------------------------------------------------ demo controls

/** What the care team says back in the demo, after the patient writes. */
const CARE_TEAM_REPLY = "Thanks for your message. I've read it, and I'll get back to you with an answer shortly.";

/**
 * Sandbox stand-ins for what happens outside the patient's app — a clinician
 * deciding, the pharmacy shipping — so a demo can move a patient along live.
 * Local sandbox copies only: each one refuses anything else.
 */
export async function demoAction(_prev: PortalActionState, formData: FormData): Promise<PortalActionState> {
  if (process.env.NODE_ENV !== "development" || !isSandboxBaseUrl(process.env.LITHOS_API_BASE_URL)) {
    return { status: "error", errors: [{ code: "portal.demo_only", message: "Demo controls work on a local sandbox copy only." }] };
  }
  const step = String(formData.get("step") ?? "");
  const id = encodeURIComponent(String(formData.get("id") ?? ""));
  const client = getLithosClient();
  try {
    switch (step) {
      case "approve": {
        const { chose } = await signOffAsClinician(client, id);
        revalidatePath("/portal", "layout");
        return { status: "done", message: chose ? `Approved — prescribed ${chose}.` : "Approved." };
      }
      case "decline":
        await declineAsClinician(client, id);
        break;
      case "ask": {
        const program = programFor(String(formData.get("program") ?? ""));
        await askPatientAsClinician(client, id, contentFor(program?.key ?? "lipid_management").clinicianQuestion);
        break;
      }
      case "ship":
        await client.post(`/v1/sandbox/orders/${id}/place`, {});
        break;
      case "deliver":
        await client.post(`/v1/sandbox/orders/${id}/complete`, {});
        break;
      case "reply":
        await client.post(`/v1/sandbox/inquiries/${id}/messages`, { body: CARE_TEAM_REPLY });
        break;
      default:
        return { status: "error", errors: [{ code: "portal.unknown_step", message: `Nothing called "${step}".` }] };
    }
  } catch (error) {
    return failed(error);
  }
  revalidatePath("/portal", "layout");
  return { status: "done" };
}
