"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLithosClient } from "@/lib/lithos/client";
import { LithosApiError } from "@/lib/lithos/errors";
import type { ApiError } from "@/lib/lithos/types";
import { readPortalPatientId, signInAs, signOut } from "@/lib/portal/session";

export type ReplyState = { status: "idle" | "sent" } | { status: "error"; httpStatus?: number; errors: ApiError[] };

/** Demo sign-in: become one of the organization's sample patients. */
export async function signInAction(formData: FormData): Promise<void> {
  const patientId = String(formData.get("patient_id") ?? "");
  if (patientId) await signInAs(patientId);
  redirect("/portal");
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/portal");
}

/**
 * The patient answers the care team. Lithos can't reach the patient — the
 * partner's app relays what they write, as the member dashboard does.
 */
export async function replyAction(_prev: ReplyState, formData: FormData): Promise<ReplyState> {
  const inquiryId = String(formData.get("inquiry_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { status: "error", errors: [{ code: "portal.empty_reply", message: "Write your answer first." }] };
  if (!(await readPortalPatientId())) return { status: "error", errors: [{ code: "portal.signed_out", message: "Sign in again to reply." }] };

  try {
    await getLithosClient().post(`/v1/inquiries/${encodeURIComponent(inquiryId)}/messages`, { body });
  } catch (error) {
    if (!(error instanceof LithosApiError)) throw error;
    return { status: "error", httpStatus: error.status, errors: error.errors };
  }
  revalidatePath("/portal");
  return { status: "sent" };
}
