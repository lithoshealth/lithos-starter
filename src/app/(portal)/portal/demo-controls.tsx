"use client";

import { useActionState } from "react";
import type { PortalData } from "@/lib/portal/view";
import { demoAction, type PortalActionState } from "./actions";

type Move = { step: string; id: string; label: string };

/** The moves that make sense for this patient right now — at most a few. */
function moves(data: PortalData): Move[] {
  const out: Move[] = [];
  const encounter = [...data.encounters].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const reviewable = encounter && encounter.modality !== "sync" && ["pending_review", "in_review", "escalated"].includes(encounter.status);
  if (reviewable) {
    out.push({ step: "approve", id: encounter.id, label: "Clinician approves" });
    if (encounter.status !== "escalated") out.push({ step: "ask", id: encounter.id, label: "Clinician asks a question" });
    out.push({ step: "decline", id: encounter.id, label: "Clinician declines" });
  }
  const order = data.orders.find((o) => o.status === "pending" || o.status === "processing" || o.status === "placed");
  if (order) out.push(order.status === "placed" ? { step: "deliver", id: order.id, label: "Delivered" } : { step: "ship", id: order.id, label: "Pharmacy ships" });
  const waiting = data.inquiries.find((i) => i.status === "open" && i.awaiting === "staff");
  if (waiting) out.push({ step: "reply", id: waiting.id, label: "Care team replies" });
  return out;
}

/**
 * Sandbox stand-ins for the people outside the app — the clinician, the
 * pharmacy, the care team — so a demo moves on while you present. Shown on a
 * local sandbox copy only; never part of the patient's app.
 */
export function DemoControls({ data }: { data: PortalData }) {
  const [state, run, pending] = useActionState<PortalActionState, FormData>(demoAction, { status: "idle" });
  const available = moves(data);
  const program = data.carePlans[0]?.category ?? "";
  return (
    <aside className="app-demo" aria-label="Demo controls">
      <p className="app-demo-title">Demo controls <span>sandbox only</span></p>
      {available.length ? (
        <div className="app-demo-moves">
          {available.map((m) => (
            <form key={m.step} action={run}>
              <input type="hidden" name="step" value={m.step} />
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="program" value={program} />
              <button className="app-demo-btn" disabled={pending}>{m.label}</button>
            </form>
          ))}
        </div>
      ) : (
        <p className="app-demo-none">Nothing to move along right now.</p>
      )}
      {pending && <p className="app-demo-status">Working…</p>}
      {!pending && state.status === "done" && state.message && <p className="app-demo-status">{state.message}</p>}
      {!pending && state.status === "error" && (
        <p className="app-demo-error" role="alert">{state.httpStatus ? `Lithos answered ${state.httpStatus}: ` : ""}{state.errors.map((e) => e.message).join(" ")}</p>
      )}
    </aside>
  );
}
