"use client";

import Link from "next/link";
import { useScrollToFeedback } from "@/lib/use-scroll-to-feedback";
import { useActionState, useEffect, useRef } from "react";
import { joinAction } from "./actions";
import { INITIAL_JOIN_STATE } from "@/lib/join-state";

export function JoinForm({ initialPlan }: { initialPlan: "essential" | "complete" }) {
  const [state, action, pending] = useActionState(joinAction, INITIAL_JOIN_STATE);
  const feedbackRef = useScrollToFeedback(state, state.status === "failed");
  const emailRef = useRef<HTMLInputElement>(null);

  // A fresh sample email per visit — members.email is unique, and a demo gets
  // filled in repeatedly. Set after mount so server and client render the same.
  useEffect(() => {
    const input = emailRef.current;
    if (input && !input.value) input.value = `sample.member+${Date.now()}@example.com`;
  }, []);

  const errorFor = (field: string) =>
    state.status === "failed" ? state.errors.find((e) => e.field === field)?.message : undefined;

  const noDatabase = state.status === "failed" && state.errors.some((e) => e.field === "database");

  return (
    <form action={action} className="stack">
      <div ref={feedbackRef} className="feedback-anchor">
{noDatabase && (
        <section className="not-connected stack" aria-live="polite">
          <p className="eyebrow">No member database yet</p>
          <h2>Your details are fine — there&rsquo;s just nowhere to keep them.</h2>
          <p>
            Joining never touches Lithos. A membership is yours: this form writes the member to <em>your</em> database,
            where they can stay for months — panels, coaching, habits — before any clinician is involved. Lithos comes in
            later, when a member needs care, through a care review.
          </p>
          <p>
            This copy of the app doesn&rsquo;t have that database. Run <code>./scripts/db-up.sh</code> locally, or set{" "}
            <code>DATABASE_URL</code> where it&rsquo;s deployed. If you haven&rsquo;t connected the app to Lithos yet either,
            start there — the <Link href="/setup">setup walkthrough</Link> needs no database at all.
          </p>
        </section>
      )}

      {state.status === "failed" && !noDatabase && (
        <section className="error-box" aria-live="polite">
          <h2>Please check your details</h2>
          <ul>
            {state.errors.map((error, index) => <li key={`${error.field}-${index}`}>{error.message}</li>)}
          </ul>
        </section>
      )}
      </div>

      <fieldset className="form-section">
        <h2>Your plan</h2>
        <div className="choice-row">
          <label className="choice">
            <input type="radio" name="plan" value="essential" defaultChecked={initialPlan === "essential"} />
            Essential — $39/month
          </label>
          <label className="choice">
            <input type="radio" name="plan" value="complete" defaultChecked={initialPlan === "complete"} />
            Complete — $89/month
          </label>
        </div>
        <p className="hint">You can switch plans at any time. We won&rsquo;t charge a card in this demo.</p>
      </fieldset>

      <fieldset className="form-section">
        <h2>About you</h2>
        <div className="field-grid">
          <label className="field">First name
            <input name="first_name" required defaultValue="Sample" />
            {errorFor("first_name") && <small className="error-text">{errorFor("first_name")}</small>}
          </label>
          <label className="field">Last name
            <input name="last_name" required />
          </label>
          <label className="field">Email
            <input ref={emailRef} name="email" type="email" required />
            {errorFor("email") && <small className="error-text">{errorFor("email")}</small>}
          </label>
          <label className="field">Mobile
            <input name="phone" required defaultValue="+12125550142" />
            {errorFor("phone") && <small className="error-text">{errorFor("phone")}</small>}
          </label>
          <label className="field">Date of birth
            <input name="date_of_birth" type="date" required />
            {errorFor("date_of_birth") && <small className="error-text">{errorFor("date_of_birth")}</small>}
          </label>
          <label className="field">Sex at birth
            <select name="sex" required defaultValue="">
              <option value="" disabled>Select…</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <h2>Where your panels ship</h2>
        <div className="field-grid">
          <label className="field wide">Street address
            <input name="address_line1" required defaultValue="410 Sample Street" />
          </label>
          <label className="field wide">Apartment, suite <small>optional</small>
            <input name="address_line2" />
          </label>
          <label className="field">City
            <input name="city" required defaultValue="Brooklyn" />
          </label>
          <label className="field">State
            <input name="state" required maxLength={2} defaultValue="NY" />
          </label>
          <label className="field">ZIP code
            <input name="postal_code" required defaultValue="11201" />
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <h2>Anything you already know</h2>
        <p className="hint">
          Optional. If you&rsquo;ve had cholesterol tested recently, your coach will start from it rather than waiting a
          quarter — and it stays in your record as the first point on the line.
        </p>
        <div className="field-grid">
          <label className="field">Most recent LDL-C <small>mg/dL</small>
            <input name="prior_ldl_c" inputMode="decimal" />
            {errorFor("prior_ldl_c") && <small className="error-text">{errorFor("prior_ldl_c")}</small>}
          </label>
          <label className="field">Date drawn
            <input name="prior_drawn_on" type="date" />
            {errorFor("prior_drawn_on") && <small className="error-text">{errorFor("prior_drawn_on")}</small>}
          </label>
          <label className="field">Total cholesterol <small>optional</small>
            <input name="prior_total_cholesterol" inputMode="decimal" />
          </label>
          <label className="field">Anything you take for cholesterol now <small>optional</small>
            <input name="current_lipid_medication" placeholder="e.g. atorvastatin 20 mg" />
          </label>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <h2>Before you join</h2>
        <div className="check-list">
          <label className="check">
            <input type="checkbox" name="membership_consent" />
            <span>
              I agree to the Eucardia membership terms and privacy policy. I understand membership includes coaching and
              lab panels, and that <strong>joining is not a request for medical care</strong> — if I later need
              treatment, I&rsquo;ll be asked to consent to it separately.
            </span>
          </label>
          <label className="check">
            <input type="checkbox" name="sample_attestation" />
            <span>These are sample details for a demo build, not a real person&rsquo;s.</span>
          </label>
        </div>
        {errorFor("membership_consent") && <small className="error-text">{errorFor("membership_consent")}</small>}
        {errorFor("sample_attestation") && <small className="error-text">{errorFor("sample_attestation")}</small>}
      </fieldset>

      <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
        {pending ? "Setting up your membership…" : "Join Eucardia"}
      </button>
    </form>
  );
}
