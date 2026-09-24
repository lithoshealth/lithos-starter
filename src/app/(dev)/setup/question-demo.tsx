"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { INITIAL_SETUP_ACTION_STATE } from "@/lib/setup/action-state";
import { askNewPatientAction } from "./actions";
import { ActionError } from "./step-actions";

/**
 * Step 5's trigger. The clinician's question is written already, from the
 * program's content, and the prospect can change it before sending.
 */
export function AskQuestionForm({ question, again }: { question: string; again?: boolean }) {
  const [state, ask, pending] = useActionState(askNewPatientAction, INITIAL_SETUP_ACTION_STATE, "/setup#step-updates");
  return (
    <form action={ask} className="stack ask-question">
      <label className="field">
        The clinician&rsquo;s question
        <textarea name="question" rows={3} defaultValue={question} required maxLength={10_000} />
      </label>
      <div>
        <button type="submit" className={again ? "btn btn-ghost" : "btn btn-primary"} disabled={pending}>
          {pending ? "Asking…" : again ? "Ask another patient" : "Ask a patient this question"}
        </button>
      </div>
      <p className="muted">
        Creates a new sample patient with a care request, then plays the clinician asking them this before deciding.
      </p>
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
  return (
    <p className="demo-note waiting" aria-live="polite">
      Question asked. Waiting for Lithos to tell your app — usually a few seconds…
    </p>
  );
}
