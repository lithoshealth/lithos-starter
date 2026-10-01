"use client";

import { useActionState } from "react";
import type { Inquiry, InquirySender } from "@/lib/lithos/types";
import { replyToInquiryAction, type ActionState } from "./actions";
import { IdempotencyField } from "@/app/idempotency-field";

function when(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "";
}

function isPatient(sender: InquirySender): boolean {
  return sender.type === "patient";
}

/** "You" for the member; the clinician by name and credentials, e.g. "Dr. Jane Doe, MD". */
function senderLabel(sender: InquirySender): string {
  if (isPatient(sender)) return "You";
  const name = [sender.first_name, sender.last_name].filter(Boolean).join(" ");
  if (!name) return "Care team";
  return "credentials" in sender && sender.credentials ? `${name}, ${sender.credentials}` : name;
}

/**
 * One inquiry, as the member sees it: the care team's messages, the member's
 * replies, and — only while the ball is in the member's court — a reply box.
 */
export function InquiryThread({ memberId, inquiry }: { memberId: string; inquiry: Inquiry }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(replyToInquiryAction, { status: "idle" });
  const open = inquiry.status === "open";
  const yourTurn = open && inquiry.awaiting === "patient";

  return (
    <article className="form-section">
      <div className="page-heading">
        <div>
          <h2>{inquiry.subject ?? "A question from your care team"}</h2>
          <p className="hint">
            <span className={`badge ${open ? (yourTurn ? "badge-warning" : "badge-info") : "badge-outline"}`}>
              {open ? (yourTurn ? "Your reply needed" : "Waiting on the care team") : inquiry.status}
            </span>
            {" "}<span className="muted">{inquiry.id}</span>
          </p>
        </div>
      </div>

      <div className="stack">
        {(inquiry.messages ?? []).map((m) => (
          <div key={m.id} className={isPatient(m.sender) ? "notes" : "demo-note"}>
            <strong>{senderLabel(m.sender)}</strong> <span className="muted">{when(m.created_at)}</span>
            <p>{m.body}</p>
          </div>
        ))}
        {inquiry.status === "closed" && inquiry.closed_note && (
          <div className="empty-state"><strong>Closed ({inquiry.closed_reason}).</strong> {inquiry.closed_note}</div>
        )}
      </div>

      {yourTurn && (
        <form action={action} className="stack">
          <IdempotencyField renewOn={state} />
          <input type="hidden" name="member_id" value={memberId} />
          <input type="hidden" name="inquiry_id" value={inquiry.id} />
          {state.status === "error" && <div className="error-box"><ul>{state.errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul></div>}
          {state.status === "ok" && <p className="muted">{state.message}</p>}
          <label className="field">Your reply<textarea name="body" rows={3} required /></label>
          <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send reply"}</button></div>
        </form>
      )}
    </article>
  );
}
