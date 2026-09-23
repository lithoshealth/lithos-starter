"use server";

import { redirect } from "next/navigation";
import { getLithosClient } from "@/lib/lithos/client";
import { lithosConnection, notConnectedError } from "@/lib/lithos/connection";
import { parseJourneyForm, runJourney, type JourneyState } from "@/lib/journey";
import { DEFAULT_PROGRAM, readConfig } from "@/lib/starter-config";

export async function createJourneyAction(_previous: JourneyState, formData: FormData): Promise<JourneyState> {
  const { program } = await readConfig();
  const parsed = parseJourneyForm(formData, program ?? DEFAULT_PROGRAM);
  if (!parsed.ok) return { status: "failed", stage: "validation", errors: parsed.errors };

  // Validate first, then check the connection: the visitor learns their form
  // was fine, and that what's missing is somewhere to send it.
  if (!lithosConnection().connected) return { status: "failed", stage: "connection", errors: [notConnectedError()] };

  const result = await runJourney(parsed.value, getLithosClient());
  if (result.status === "complete") redirect(`/care/${encodeURIComponent(result.encounterId)}`);
  return result;
}
