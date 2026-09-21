"use server";

import { revalidatePath } from "next/cache";
import { getLithosClient } from "@/lib/lithos/client";
import { lithosConnection, notConnectedError } from "@/lib/lithos/connection";
import { LithosApiError } from "@/lib/lithos/errors";
import { signOffAsClinician } from "@/lib/sandbox-review";
import type { ClinicianState } from "@/lib/sandbox-review-state";

/** Sandbox only: sign the visitor's own encounter off, so the app's loop closes like the walkthrough's. */
export async function playClinicianAction(_prev: ClinicianState, formData: FormData): Promise<ClinicianState> {
  const encounterId = String(formData.get("encounter_id") ?? "");
  if (!lithosConnection().connected) return { status: "error", errors: [notConnectedError()] };
  try {
    const { chose } = await signOffAsClinician(getLithosClient(), encounterId);
    revalidatePath(`/care/${encounterId}`);
    return { status: "ok", chose };
  } catch (error) {
    if (error instanceof LithosApiError) return { status: "error", httpStatus: error.status, errors: error.errors };
    return { status: "error", errors: [{ code: "sandbox.sign_off_failed", message: error instanceof Error ? error.message : String(error) }] };
  }
}
