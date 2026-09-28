import type { LithosClient } from "./lithos/client";
import type { Patient } from "./lithos/types";

/**
 * The zone to show a patient's visit times in. Lithos looks it up from the
 * patient's ZIP (or keeps the one the partner set), so the server never has to
 * guess from the state. It's null when the ZIP can't be placed: fall back to
 * UTC, which the label then says plainly.
 */
export async function readPatientTimeZone(client: LithosClient, patientId: string): Promise<string> {
  const patient = await client.get<Patient>(`/v1/patients/${encodeURIComponent(patientId)}`);
  return patient.time_zone ?? "UTC";
}

export function formatVisitTime(iso: string, timeZone: string, style: "full" | "time" | "day" = "full"): string {
  const options: Intl.DateTimeFormatOptions =
    style === "time"
      ? { timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }
      : style === "day"
        ? { timeZone, weekday: "short", month: "short", day: "numeric" }
        : { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  return new Intl.DateTimeFormat("en-US", options).format(new Date(iso));
}
