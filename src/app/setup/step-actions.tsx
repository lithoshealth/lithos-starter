"use client";

import { useActionState } from "react";
import { INITIAL_SETUP_ACTION_STATE, type SetupActionState } from "@/lib/setup/action-state";
import { registerWebhookAction } from "./actions";

function ActionError({ state }: { state: SetupActionState }) {
  if (state.status !== "error") return null;
  return (
    <div className="error-box" aria-live="polite">
      <h2>{state.httpStatus ? `Lithos answered HTTP ${state.httpStatus}` : "That didn't work"}</h2>
      <ul>
        {state.errors.map((error, index) => (
          <li key={`${error.code}-${index}`}>
            {error.message} <code className="muted">{error.code}</code>
            {error.source?.pointer && <code className="muted"> {error.source.pointer}</code>}
          </li>
        ))}
      </ul>
      {state.hint && <p className="muted">{state.hint}</p>}
    </div>
  );
}

/** One button, one real API call. The page re-reads Lithos afterwards to decide whether it worked. */
export function StepAction({
  action,
  label,
  pendingLabel,
}: {
  action: (state: SetupActionState) => Promise<SetupActionState>;
  label: string;
  pendingLabel: string;
}) {
  const [state, run, pending] = useActionState(action, INITIAL_SETUP_ACTION_STATE);
  return (
    <form action={run} className="stack">
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? pendingLabel : label}</button>
      </div>
      <ActionError state={state} />
    </form>
  );
}

export function WebhookForm({ defaultUrl }: { defaultUrl: string }) {
  const [state, run, pending] = useActionState(registerWebhookAction, INITIAL_SETUP_ACTION_STATE);

  if (state.status === "secret") {
    return (
      <div className="setup-secret stack" aria-live="polite">
        <p><strong>Registered.</strong> Lithos will deliver to <code>{state.url}</code>.</p>
        <p>
          This is your signing secret. <strong>Lithos shows it exactly once</strong> — copy it now. This page doesn&rsquo;t
          store it, and reloading will lose it.
        </p>
        <pre className="setup-json">{state.signingSecret}</pre>
        <ol>
          <li>Add it to your environment as <code>LITHOS_WEBHOOK_SECRET</code> (<code>.env.local</code>, or your host&rsquo;s env settings).</li>
          <li>Restart the app (or redeploy) so it picks the secret up.</li>
          <li>Come back here — the next step turns green on the first verified delivery.</li>
        </ol>
      </div>
    );
  }

  return (
    <form action={run} className="stack">
      <label className="field">
        Your app&rsquo;s public HTTPS address
        <input name="public_url" defaultValue={defaultUrl} placeholder="https://your-app.vercel.app" required />
        <small>We&rsquo;ll register <code>…/api/webhooks/lithos</code> on it. Localhost can&rsquo;t receive webhooks — use your deployed URL or a tunnel.</small>
      </label>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Registering…" : "Register webhook endpoint"}</button>
      </div>
      <ActionError state={state} />
    </form>
  );
}
