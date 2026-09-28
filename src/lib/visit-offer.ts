import type { LithosClient } from "./lithos/client";
import { LithosApiError } from "./lithos/errors";
import { readClock } from "./sandbox-clock";
import { isSandboxBaseUrl } from "./sandbox-review";
import { listSlots, slotDays, slotWindow, type VisitOffer } from "./sync-visits";
import { formatVisitTime, readPatientTimeZone } from "./time-zones";

/**
 * The times to offer a patient who needs a visit, before any encounter exists.
 * In sandbox the grid is built on the test clock, so page from the clock's
 * "now" rather than the wall clock's.
 */
export async function loadVisitOffer(
  client: LithosClient,
  input: { patientId: string; carePlanId: string; from?: string },
): Promise<VisitOffer> {
  const sandbox = isSandboxBaseUrl(process.env.LITHOS_API_BASE_URL);
  const base: VisitOffer = { timeZone: "UTC", sandbox, clockLabel: null, days: [], reason: null, nextAvailable: null, laterFrom: null };
  try {
    const [timeZone, clock] = await Promise.all([
      readPatientTimeZone(client, input.patientId),
      sandbox ? readClock(client) : Promise.resolve(null),
    ]);
    base.timeZone = timeZone;
    const now = clock ? new Date(clock.frozen_time) : new Date();
    const from = input.from && Date.parse(input.from) > now.getTime() ? new Date(input.from) : now;
    const range = slotWindow(from);
    const answer = await listSlots(client, { patientId: input.patientId, carePlanId: input.carePlanId, ...range });
    return {
      ...base,
      clockLabel: clock ? `${formatVisitTime(clock.frozen_time, timeZone)} (${clock.frozen_time})` : null,
      days: slotDays(answer.slots, timeZone),
      reason: answer.reason,
      nextAvailable: answer.next_available,
      laterFrom: answer.slots.length > 0 ? range.to : null,
    };
  } catch (error) {
    if (!(error instanceof LithosApiError)) throw error;
    return { ...base, error: { httpStatus: error.status, errors: error.errors } };
  }
}
