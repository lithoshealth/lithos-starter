"use client";

import { useActionState, type ReactNode } from "react";
import { INITIAL_SETUP_ACTION_STATE, type SetupActionState } from "@/lib/setup/action-state";
import { registerWebhookAction, repointWebhookAction } from "./actions";

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

/** The signing secret, shown the one time Lithos returns it — with the exact line to paste. */
function SecretOnce({ url, signingSecret }: { url: string; signingSecret: string }) {
  return (
    <div className="setup-secret stack" aria-live="polite">
      <p><strong>Registered.</strong> Lithos will deliver to <code>{url}</code>.</p>
      <p>
        Here&rsquo;s your signing secret. <strong>Lithos shows it exactly once</strong> — this page doesn&rsquo;t store
        it, and reloading loses it. Add this line to <code>.env.local</code> (replacing any existing
        <code> LITHOS_WEBHOOK_SECRET</code> line):
      </p>
      <pre className="setup-json">{`LITHOS_WEBHOOK_SECRET=${signingSecret}`}</pre>
      <p className="muted">
        In development the app picks it up on the next request. On a deployed copy, set it in your host&rsquo;s
        environment settings and redeploy. Then go to step 8.
      </p>
    </div>
  );
}

export function WebhookForm({ defaultUrl }: { defaultUrl: string }) {
  const [state, run, pending] = useActionState(registerWebhookAction, INITIAL_SETUP_ACTION_STATE);
  if (state.status === "secret") return <SecretOnce url={state.url} signingSecret={state.signingSecret} />;

  return (
    <form action={run} className="stack">
      <label className="field">
        Your app&rsquo;s public HTTPS address
        <input name="public_url" defaultValue={defaultUrl} placeholder="https://something.trycloudflare.com" required />
        <small>We&rsquo;ll register <code>…/api/webhooks/lithos</code> on it.</small>
      </label>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Registering…" : "Register webhook endpoint"}</button>
      </div>
      <ActionError state={state} />
    </form>
  );
}

/** For when the organization's one endpoint points somewhere else — a stale tunnel, or another copy of the app. */
export function RepointForm({
  currentId, currentUrl, defaultUrl, children,
}: { currentId: string; currentUrl: string; defaultUrl: string; children?: ReactNode }) {
  const [state, run, pending] = useActionState(repointWebhookAction, INITIAL_SETUP_ACTION_STATE);
  if (state.status === "secret") return <SecretOnce url={state.url} signingSecret={state.signingSecret} />;

  return (
    <details className="setup-detail">
      <summary>Point your endpoint at this app instead</summary>
      {children}
      <form action={run} className="stack" style={{ marginTop: "0.5rem" }}>
        <input type="hidden" name="current_endpoint_id" value={currentId} />
        <label className="field">
          This app&rsquo;s public HTTPS address
          <input name="public_url" defaultValue={defaultUrl} placeholder="https://something.trycloudflare.com" required />
        </label>
        <label className="check">
          <input type="checkbox" name="confirm_repoint" />
          <span>
            I understand <code>{currentUrl}</code> stops receiving deliveries. Your organization can have one active
            endpoint, disabling is permanent, and pointing it back later issues yet another secret.
          </span>
        </label>
        <div>
          <button type="submit" className="btn btn-ghost" disabled={pending}>{pending ? "Re-pointing…" : "Disable the old one and register this address"}</button>
        </div>
        <ActionError state={state} />
      </form>
    </details>
  );
}
