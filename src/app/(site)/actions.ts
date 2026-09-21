"use server";

import { redirect } from "next/navigation";
import { getLithosClient } from "@/lib/lithos/client";
import { parseJourneyForm, runJourney, type JourneyState } from "@/lib/journey";

export async function createJourneyAction(_previous: JourneyState, formData: FormData): Promise<JourneyState> {
  const parsed = parseJourneyForm(formData);
  if (!parsed.ok) return { status: "failed", stage: "validation", errors: parsed.errors };

  const result = await runJourney(parsed.value, getLithosClient());
  if (result.status === "complete") redirect(`/care/${encodeURIComponent(result.encounterId)}`);
  return result;
}
