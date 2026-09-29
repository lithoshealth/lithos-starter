"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { INITIAL_SETUP_ACTION_STATE, type IssuedCredentials, type SetupActionState } from "@/lib/setup/action-state";
import { connectAction, getSandboxCredentialsAction, chooseProgramAction, registerWebhookAction, repointWebhookAction, resetSetupAction } from "./actions";
import type { ProgramOption } from "@/lib/setup/programs";

export function ActionError({ state }: { state: SetupActionState }) {
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

/**
 * Where a form lands if it submits before the page's JavaScript has loaded
 * (React's permalink): a full reload would otherwise start at the top of the
 * page. With JavaScript, the page updates in place and this isn't used.
 */
function stepAnchor(step: string): string {
  return `/setup#step-${step}`;
}

/** What step 1 shows once either form has connected the app — and, after a signup, what was just created. */
export function Connected({ treatments, issued }: { treatments?: number; issued?: IssuedCredentials }) {
  return (
    <div className="demo-note stack">
      <h2>{issued ? "Your sandbox credentials" : "Connected"}</h2>
      {issued && (
        <dl className="credentials">
          <div><dt>Organization</dt><dd>{issued.organizationName} <code>{issued.organizationId}</code></dd></div>
          <div><dt>Client ID</dt><dd><code>{issued.clientIdMasked}</code></dd></div>
          <div><dt>Client secret</dt><dd><code>{issued.clientSecretMasked}</code></dd></div>
        </dl>
      )}
      <p>
        {issued ? "Both are saved to " : "Saved to "}<code>.env.local</code>, which git ignores
        {issued ? " — the full secret only lives there: Lithos shows it once, and this page never does." : "."}{" "}
        {treatments !== undefined && <>Lithos accepted them and returned {treatments} treatment{treatments === 1 ? "" : "s"} in your formulary.</>}
      </p>
      <p><a className="btn btn-primary" href="/setup#step-program">{issued ? "Continue to step 2" : "Reload"}</a></p>
    </div>
  );
}

/**
 * Step 1, in the page. First choice: get sandbox credentials here — an email
 * and a company name, and Lithos's sandbox creates an organization and returns
 * its client ID and secret, straight into .env.local. Second: paste credentials
 * you already have.
 *
 * Development only — a deployed copy has no .env.local, and the step shows the
 * variables to set in the host instead. Nothing is saved until Lithos accepts
 * the pair, and the secret is never rendered back.
 */
export function ConnectForm({ companyName, handedOver }: { companyName: string; handedOver?: boolean }) {
  const [signup, getCredentials, signingUp] = useActionState(getSandboxCredentialsAction, INITIAL_SETUP_ACTION_STATE, stepAnchor("connect"));
  const [state, run, pending] = useActionState(connectAction, INITIAL_SETUP_ACTION_STATE, stepAnchor("connect"));

  if (signup.status === "connected") return <Connected treatments={signup.treatments} issued={signup.issued} />;
  if (state.status === "connected") return <Connected treatments={state.treatments} />;

  const signupForm = (
    <form action={getCredentials} className="stack">
      <label className="field">
        Your email
        <input name="email" type="email" placeholder="you@yourcompany.com" autoComplete="email" required />
      </label>
      <label className="field">
        Company name
        <input name="organization_name" defaultValue={companyName} autoComplete="organization" required />
      </label>
      <div>
        <button type="submit" className={handedOver ? "btn btn-ghost" : "btn btn-primary"} disabled={signingUp}>
          {signingUp ? "Creating your sandbox…" : "Get sandbox credentials"}
        </button>
      </div>
      <p className="muted">
        Creates {handedOver ? "a new, empty" : "your own"} sandbox organization with every program, and saves its credentials to{" "}
        <code>.env.local</code>. The secret goes straight there — this page never shows it.
      </p>
      <ActionError state={signup} />
    </form>
  );

  const pasteForm = (
    <form action={run} className="stack">
      <label className="field">
        Client ID
        <input name="client_id" placeholder="client_…" autoComplete="off" spellCheck={false} required />
      </label>
      <label className="field">
        Client secret
        {/* type=password so it isn't left on screen in a demo or a screen share. */}
        <input name="client_secret" type="password" autoComplete="off" spellCheck={false} required />
      </label>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Checking with Lithos…" : "Connect"}</button>
      </div>
      <p className="muted">
        Checked with Lithos before anything is saved, then written to <code>.env.local</code> — gitignored, and never sent anywhere
        but Lithos. Prefer a terminal? <code>npm run setup</code> asks the same two questions.
      </p>
      <ActionError state={state} />
    </form>
  );

  // A copy handed over after a demo leads with the credentials that came with
  // it: they reconnect it to the demo's organization, where everything is.
  if (handedOver) {
    return (
      <div className="stack">
        <p><strong>Paste the credentials we sent you</strong> (the 1Password item) to pick up where we left off.</p>
        {pasteForm}
        <details className="setup-detail">
          <summary>Start with a new sandbox organization instead</summary>
          {signupForm}
        </details>
      </div>
    );
  }

  return (
    <div className="stack">
      {signupForm}
      <details className="setup-detail">
        <summary>Already have credentials? Paste them</summary>
        {pasteForm}
      </details>
    </div>
  );
}

/** One button, one real API call. The page re-reads Lithos afterwards to decide whether it worked. */
export function StepAction({
  action,
  label,
  pendingLabel,
  step,
  variant = "primary",
}: {
  action: (state: SetupActionState) => Promise<SetupActionState>;
  label: string;
  pendingLabel: string;
  /** The step this button belongs to — where the page lands if it has to reload. */
  step: string;
  variant?: "primary" | "ghost";
}) {
  const [state, run, pending] = useActionState(action, INITIAL_SETUP_ACTION_STATE, stepAnchor(step));
  return (
    <form action={run} className="stack">
      <div>
        <button type="submit" className={`btn btn-${variant}`} disabled={pending}>{pending ? pendingLabel : label}</button>
      </div>
      <ActionError state={state} />
    </form>
  );
}

/**
 * Step 2. Every program is listed, with what this organization's formulary has
 * for it — including the ones it can't pick yet, because seeing what exists is
 * part of the point.
 */
export function ProgramPicker({ programs }: { programs: ProgramOption[] }) {
  const [state, run, pending] = useActionState(chooseProgramAction, INITIAL_SETUP_ACTION_STATE, stepAnchor("program"));
  const preselected = programs.find((p) => p.selectable)?.key;
  return (
    <form action={run} className="stack">
      <fieldset className="program-picker">
        <legend>What program is your organization offering?</legend>
        {programs.filter((p) => p.selectable).length === 1 && (
          <p className="muted">
            Pre-selected: it&rsquo;s the only program in your formulary — Lithos set your organization up for it. Confirm
            to continue.
          </p>
        )}
        {programs.map((p) => (
          <label key={p.key} className={`program-option${p.selectable ? "" : " program-option-disabled"}`}>
            <input type="radio" name="program" value={p.key} disabled={!p.selectable} defaultChecked={p.key === preselected} />
            <span className="program-option-body">
              <span className="program-option-title">
                {p.label}
                {!p.supported && <span className="pill">Coming soon</span>}
                {p.supported && !p.inFormulary && <span className="pill">Not in your formulary</span>}
              </span>
              <span className="muted">{p.inFormulary ? <>In your formulary: {p.treatments.join(", ")}.</> : <>Your organization isn&rsquo;t provisioned for it.</>}</span>
              <span className="muted">Its intake asks {p.asks}.</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending || !preselected}>
          {pending ? "Saving…" : "Use this program"}
        </button>
      </div>
      <ActionError state={state} />
    </form>
  );
}

/** Re-reads step 5 now that the app can hear Lithos, and brings the demo into view. */
function TryItButton() {
  const router = useRouter();
  return (
    <button type="button" className="btn btn-primary" onClick={() => {
      router.refresh();
      document.getElementById("webhook-demo")?.scrollIntoView({ block: "start" });
    }}>Try it: ask the patient a question ↑</button>
  );
}

/** The signing secret, shown the one time Lithos returns it — with the exact line to paste. */
function SecretOnce({ url, signingSecret, saved }: { url: string; signingSecret: string; saved: boolean }) {
  if (saved) {
    return (
      <div className="setup-secret stack" aria-live="polite">
        <p><strong>Registered.</strong> Lithos will deliver to <code>{url}</code>.</p>
        <p>
          Lithos returned a signing secret — it only ever does this once — and it&rsquo;s been saved to{" "}
          <code>.env.local</code> as <code>LITHOS_WEBHOOK_SECRET</code>. Nothing to copy. The app uses it to check every
          delivery really came from Lithos.
        </p>
        <div><TryItButton /></div>
      </div>
    );
  }
  return (
    <div className="setup-secret stack" aria-live="polite">
      <p><strong>Registered.</strong> Lithos will deliver to <code>{url}</code>.</p>
      <p>
        Here&rsquo;s your signing secret. <strong>Lithos shows it exactly once</strong> — this page doesn&rsquo;t store
        it, and reloading loses it. Set it in your host&rsquo;s environment settings, then redeploy:
      </p>
      <pre className="setup-json">{`LITHOS_WEBHOOK_SECRET=${signingSecret}`}</pre>
      <p className="muted">Lost it? Step 5 can get you a new one — it registers the address again.</p>
    </div>
  );
}

export function WebhookForm({ defaultUrl }: { defaultUrl: string }) {
  const [state, run, pending] = useActionState(registerWebhookAction, INITIAL_SETUP_ACTION_STATE, stepAnchor("updates"));
  if (state.status === "secret") return <SecretOnce url={state.url} signingSecret={state.signingSecret} saved={state.saved} />;

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
  const [state, run, pending] = useActionState(repointWebhookAction, INITIAL_SETUP_ACTION_STATE, stepAnchor("updates"));
  if (state.status === "secret") return <SecretOnce url={state.url} signingSecret={state.signingSecret} saved={state.saved} />;

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

/**
 * For when the signing secret is lost — the usual reason step 5 never goes
 * green. Lithos has no rotate call ("contact us"), so this registers the same
 * address again: disable, then create, which issues a new secret (saved to
 * .env.local in development).
 */
export function NewSecretForm({ currentId, url }: { currentId: string; url: string }) {
  const [state, run, pending] = useActionState(repointWebhookAction, INITIAL_SETUP_ACTION_STATE, stepAnchor("updates"));
  if (state.status === "secret") return <SecretOnce url={state.url} signingSecret={state.signingSecret} saved={state.saved} />;
  const base = url.replace(/\/api\/webhooks\/lithos$/, "");
  return (
    <form action={run} className="stack">
      <input type="hidden" name="current_endpoint_id" value={currentId} />
      <input type="hidden" name="public_url" value={base} />
      <input type="hidden" name="confirm_repoint" value="on" />
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Registering again…" : "Get a new signing secret"}</button>
      </div>
      <p className="muted">Registers the same address again: Lithos issues a new secret, and the old one stops working.</p>
      <ActionError state={state} />
    </form>
  );
}

/**
 * "Run again with a new patient": forget the walkthrough's patient and
 * encounter (not the program), then land on step 3, where the new run starts.
 * A plain form posting a server action — it works before the page's
 * JavaScript loads, like every other step; the action redirects to the
 * step's anchor, so the browser scrolls there itself.
 */
export function RunAgainButton({ variant = "ghost" }: { variant?: "ghost" | "primary" }) {
  return (
    <form action={resetSetupAction}>
      <RunAgainSubmit variant={variant} />
    </form>
  );
}

function RunAgainSubmit({ variant }: { variant: "ghost" | "primary" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn btn-${variant}`} disabled={pending}>
      {pending ? "Starting over…" : "Run again with a new patient"}
    </button>
  );
}
