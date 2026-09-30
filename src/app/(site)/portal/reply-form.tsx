"use client";

import { useActionState } from "react";
import { replyAction, type ReplyState } from "./actions";

/** The patient's answer to the care team's question, relayed to Lithos. */
export function ReplyForm({ inquiryId }: { inquiryId: string }) {
  const [state, reply, pending] = useActionState<ReplyState, FormData>(replyAction, { status: "idle" });
  if (state.status === "sent") return <p className="portal-sent">Sent. Your care team will pick it up from here.</p>;
  return (
    <form action={reply} className="portal-reply">
      <input type="hidden" name="inquiry_id" value={inquiryId} />
      <label className="visually-hidden" htmlFor={`reply-${inquiryId}`}>Your answer</label>
      <textarea id={`reply-${inquiryId}`} name="body" rows={2} placeholder="Write your answer" required maxLength={10_000} disabled={pending} />
      <button type="submit" className="btn portal-btn-strong" disabled={pending}>{pending ? "Sending…" : "Reply"}</button>
      {state.status === "error" && (
        <p className="portal-error" role="alert">
          {state.httpStatus ? `Lithos answered ${state.httpStatus}: ` : ""}
          {state.errors.map((e) => e.message).join(" ")}
        </p>
      )}
    </form>
  );
}
