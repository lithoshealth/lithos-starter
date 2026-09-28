import { NextResponse } from "next/server";
import { getLithosClient } from "@/lib/lithos/client";
import { lithosConnection } from "@/lib/lithos/connection";
import { LithosApiError } from "@/lib/lithos/errors";
import { readAppointment } from "@/lib/sync-visits";

export const dynamic = "force-dynamic";

/**
 * The "Join visit" button. The join window is checked again when the patient
 * arrives, so re-read the appointment at the click rather than trusting the
 * page, and only then hand over `patient_join.url` — the patient's only
 * credential for the room, which never sits in the page's HTML.
 */
export async function GET(request: Request, { params }: { params: Promise<{ encounterId: string }> }) {
  const { encounterId } = await params;
  const back = new URL(`/care/${encodeURIComponent(encounterId)}#visit`, request.url);
  const appointmentId = new URL(request.url).searchParams.get("appointment");
  if (!appointmentId || !lithosConnection().connected) return NextResponse.redirect(back, 303);

  try {
    const appointment = await readAppointment(getLithosClient(), appointmentId);
    const join = appointment.patient_join;
    if (appointment.encounter_id === encounterId && join.status === "joinable" && join.url) {
      return NextResponse.redirect(join.url, 303);
    }
  } catch (error) {
    if (!(error instanceof LithosApiError)) throw error;
  }
  return NextResponse.redirect(back, 303);
}
