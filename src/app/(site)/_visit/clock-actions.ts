"use server";

import { revalidatePath } from "next/cache";
import { getLithosClient } from "@/lib/lithos/client";
import { lithosConnection, notConnectedError } from "@/lib/lithos/connection";
import { LithosApiError } from "@/lib/lithos/errors";
import { advanceClock, createClock, deleteClock } from "@/lib/sandbox-clock";
import type { VisitActionState } from "@/lib/visit-state";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Sandbox only (the clock module refuses anything else): create, advance, or delete the test clock. */
export async function testClockAction(_prev: VisitActionState, formData: FormData): Promise<VisitActionState> {
  if (!lithosConnection().connected) return { status: "error", errors: [notConnectedError()] };
  const client = getLithosClient();
  const intent = field(formData, "intent");
  let message: string;
  try {
    if (intent === "create") {
      const clock = await createClock(client);
      message = `Test clock created at ${clock.frozen_time}.`;
    } else if (intent === "delete") {
      await deleteClock(client);
      message = "Test clock deleted — the organization is back on real time.";
    } else {
      const clock = await advanceClock(client, field(formData, "to_time"));
      message = `Clock advanced to ${clock.frozen_time}. Lithos plays the visit out in the background — refresh in a few seconds.`;
    }
  } catch (error) {
    if (error instanceof LithosApiError) return { status: "error", httpStatus: error.status, errors: error.errors };
    return { status: "error", errors: [{ code: "sample_app.integration_error", message: error instanceof Error ? error.message : String(error) }] };
  }
  const encounterId = field(formData, "encounter_id");
  if (encounterId) revalidatePath(`/care/${encodeURIComponent(encounterId)}`);
  return { status: "ok", message };
}
