"use client";

import { useActionState } from "react";
import type { QuestionThread } from "@/lib/setup/steps";
import { INITIAL_SETUP_ACTION_STATE } from "@/lib/setup/action-state";
import { replyToQuestionAction } from "./actions";
import { ActionError } from "./step-actions";

/**
 * One question in the care team's inbox: the clinician's message and, while
 * it's the patient's turn, a box to relay their answer. Pre-filled with a
 * sample answer — in production this is whatever your patient wrote in your app.
 */
export function InboxThread({ thread, sampleReply, showQuestion = true }: { thread: QuestionThread; sampleReply: string; showQuestion?: boolean }) {
  const [state, reply, pending] = useActionState(replyToQuestionAction, INITIAL_SETUP_ACTION_STATE, "/setup#step-updates");
  const theirTurn = thread.awaiting === "patient";
  return (
    <article className={theirTurn ? "inbox-thread inbox-thread-open" : "inbox-thread"}>
      {showQuestion ? (
        <>
          <p className="inbox-from">Clinician · needs an answer from your patient</p>
          <blockquote>{thread.question}</blockquote>
        </>
      ) : (
        <p className="inbox-from">Your patient answers, in your app</p>
      )}
      {thread.reply && (
        <p className="inbox-reply"><strong>Your patient replied:</strong> {thread.reply}</p>
      )}
      {theirTurn ? (
        <form action={reply} className="stack">
          <input type="hidden" name="inquiry_id" value={thread.id} />
          <label className="field">
            Your patient&rsquo;s reply, from your app
            <textarea name="body" rows={3} defaultValue={sampleReply} required />
          </label>
          <div>
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send the reply to the clinician"}</button>
          </div>
          <ActionError state={state} />
        </form>
      ) : (
        <p className="muted">Sent with <code>POST /v1/inquiries/{thread.id}/messages</code>. It&rsquo;s the clinician&rsquo;s turn: they read the answer and decide.</p>
      )}
    </article>
  );
}
