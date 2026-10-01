"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessageAction, type PortalActionState } from "./actions";
import { Icon } from "./icons";

/** The message box at the bottom of the chat. Sends into the open conversation, or starts one. */
export function Composer({ threadId, draft }: { threadId?: string; draft?: string }) {
  const [state, send, pending] = useActionState<PortalActionState, FormData>(sendMessageAction, { status: "idle" });
  const form = useRef<HTMLFormElement>(null);
  // Clear the box once it's sent; the page re-reads the thread with it in.
  useEffect(() => { if (state.status === "done") form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={send} className="chat-composer">
      {threadId && <input type="hidden" name="thread_id" value={threadId} />}
      <label className="visually-hidden" htmlFor="chat-body">Message your care team</label>
      <textarea id="chat-body" name="body" rows={1} placeholder="Message your care team…" defaultValue={draft} required maxLength={10_000} disabled={pending} />
      <button className="chat-send" aria-label="Send" disabled={pending}><Icon name="send" size={18} /></button>
      {state.status === "error" && (
        <p className="chat-error" role="alert">{state.httpStatus ? `Lithos answered ${state.httpStatus}: ` : ""}{state.errors.map((e) => e.message).join(" ")}</p>
      )}
    </form>
  );
}
