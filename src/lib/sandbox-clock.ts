/**
 * The sandbox test clock: one simulated "now" per organization.
 *
 * Sandbox can't put a real person in a video room, so moving this clock stands
 * in for people joining and leaving. A milestone fires when an advance LANDS
 * inside its window — never when it jumps over one:
 *
 *   advance to starts_at + 1 min      → both join; in_progress, encounter.in_review
 *   then advance past closes_at       → completed
 *   on a fresh booking, straight past → patient_no_show
 *
 * Set the clock before fetching slots (the grid is built on it), and advance
 * only once the room exists (`patient_join.status` has left `provisioning`).
 */

import { LithosApiError } from "./lithos/errors";
import type { LithosClient } from "./lithos/client";
import type { Appointment, SandboxTestClock } from "./lithos/types";
import { isSandboxBaseUrl } from "./sandbox-review";

const MINUTE_MS = 60_000;

function assertSandbox(): void {
  if (!isSandboxBaseUrl(process.env.LITHOS_API_BASE_URL)) {
    throw new Error("Refusing to touch a test clock outside the Lithos sandbox.");
  }
}

/** The clock, or null when the organization runs on the wall clock. */
export async function readClock(client: LithosClient): Promise<SandboxTestClock | null> {
  assertSandbox();
  try {
    return await client.get<SandboxTestClock>("/v1/sandbox/test_clock");
  } catch (error) {
    if (error instanceof LithosApiError && error.status === 404) return null;
    throw error;
  }
}

export function createClock(client: LithosClient, frozenTime?: string): Promise<SandboxTestClock> {
  assertSandbox();
  return client.post("/v1/sandbox/test_clock", frozenTime ? { frozen_time: frozenTime } : {});
}

/** Returns at once; the sweeps it queues land a few seconds later. */
export function advanceClock(client: LithosClient, toTime: string): Promise<SandboxTestClock> {
  assertSandbox();
  return client.post("/v1/sandbox/test_clock/advance", { to_time: toTime });
}

export function deleteClock(client: LithosClient): Promise<unknown> {
  assertSandbox();
  return client.delete("/v1/sandbox/test_clock");
}

export type ClockMove = { label: string; toTime: string; available: boolean; why?: string };

/**
 * The two advances that script a visit. The same "past the window" move reads
 * as a completed visit after a join, and as a no-show without one.
 */
export function visitClockMoves(appointment: Appointment, now: Date): { join: ClockMove; pastWindow: ClockMove } {
  const provisioning = appointment.patient_join.status === "provisioning";
  const roomNotReady = "The room isn't ready yet — wait for appointment.scheduled, then refresh.";

  const joinAt = new Date(Date.parse(appointment.starts_at) + MINUTE_MS);
  const closesAt = Date.parse(appointment.patient_join.closes_at ?? appointment.ends_at);
  const pastAt = new Date(closesAt + MINUTE_MS);

  return {
    join: {
      label: "Both join the room",
      toTime: joinAt.toISOString(),
      available: !provisioning && appointment.status === "scheduled" && joinAt > now,
      why: provisioning ? roomNotReady : joinAt <= now ? "The clock is already past the arrival window." : undefined,
    },
    pastWindow: {
      label: appointment.status === "in_progress" ? "End the visit" : "Nobody shows up",
      toTime: pastAt.toISOString(),
      available: !provisioning && pastAt > now,
      why: provisioning ? roomNotReady : pastAt <= now ? "The clock is already past this visit's window." : undefined,
    },
  };
}
