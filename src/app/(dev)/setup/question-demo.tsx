"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { INITIAL_SETUP_ACTION_STATE } from "@/lib/setup/action-state";
import { askNewPatientAction } from "./actions";
import { ActionError } from "./step-actions";
import { IdempotencyField } from "@/app/idempotency-field";

/**
 * Step 5's first stop: the clinician's question, written already from the
 * program's content and editable, as a chat bubble. Disabled until the app can
 * hear Lithos — asking before then would prove nothing.
 */
export function AskQuestionForm({ question, again, disabled }: { question: string; again?: boolean; disabled?: boolean }) {
  const [state, ask, pending] = useActionState(askNewPatientAction, INITIAL_SETUP_ACTION_STATE, "/setup#webhook-demo");
  return (
    <form action={ask} className="stack ask-question">
      <IdempotencyField renewOn={state} />
      <label className="visually-hidden" htmlFor={again ? "question-again" : "question"}>The clinician&rsquo;s question</label>
      <textarea
        id={again ? "question-again" : "question"} name="question" className="chat-bubble chat-bubble-clinician"
        rows={3} defaultValue={question} required maxLength={10_000} disabled={disabled || pending}
      />
      <div>
        <button type="submit" className={again ? "btn btn-ghost" : "btn btn-primary"} disabled={disabled || pending}>
          {pending ? "Asking…" : again ? "Ask another patient" : "Ask the patient"}
        </button>
      </div>
      <ActionError state={state} />
    </form>
  );
}

/**
 * While the app waits for Lithos's webhook, re-render the page every couple of
 * seconds so the delivery shows up on its own. Stops after a minute — past that,
 * something is wrong, and the step's diagnosis says what.
 */
export function WaitForWebhook() {
  const router = useRouter();
  useEffect(() => {
    // A refresh keeps this component mounted, so the count survives it.
    let left = 30;
    const timer = window.setInterval(() => {
      left -= 1;
      if (left < 0) window.clearInterval(timer);
      else router.refresh();
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [router]);
  return <span className="flow-status flow-status-waiting" aria-live="polite">Waiting for Lithos… usually a few seconds</span>;
}

/** Opens the folded developer setup and scrolls to it. */
export function OpenSetupButton() {
  return (
    <button type="button" className="link-button" onClick={() => {
      const setup = document.getElementById("webhook-setup") as HTMLDetailsElement | null;
      if (!setup) return;
      setup.open = true;
      setup.scrollIntoView({ block: "start", behavior: "smooth" });
    }}>Set it up →</button>
  );
}
