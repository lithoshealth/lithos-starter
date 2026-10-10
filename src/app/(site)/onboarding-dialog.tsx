"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { finishOnboardingAction } from "./onboarding-actions";
import { ONBOARDING_COOKIE } from "./onboarding-cookie";

/**
 * The first-run pop-up's frame. It opens by itself until the app is connected
 * and made yours; "Look around first" closes it for this browser session, and
 * the dev bar's Connect link (?connect=1) opens it again.
 */
export function OnboardingDialog({ open: openByDefault, title, children }: { open: boolean; title: string; children: ReactNode }) {
  const forced = useSearchParams().get("connect") === "1";
  const [closed, setClosed] = useState(false);
  if (closed || !(openByDefault || forced)) return null;

  function lookAround() {
    document.cookie = `${ONBOARDING_COOKIE}=later; path=/; SameSite=Lax`;
    setClosed(true);
  }

  return (
    <div className="onboard-overlay">
      <div className="onboard-dialog card stack" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
        <div className="onboard-head">
          <h2 id="onboard-title">{title}</h2>
          <button type="button" className="link-button" onClick={lookAround}>Look around first</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * The pop-up after connecting: make the app yours, then a last screen with
 * the mission — the journey to run once, in the app itself — before landing
 * on the home page. The bar at the top keeps track from there.
 */
export function MakeItYours({ open, intro, brandPanel }: { open: boolean; intro: ReactNode; brandPanel: ReactNode }) {
  const [stage, setStage] = useState<"brand" | "mission">("brand");
  if (stage === "brand") {
    return (
      <OnboardingDialog open={open} title="Make it yours">
        {intro}
        {brandPanel}
        <div><button type="button" className="btn btn-primary" onClick={() => setStage("mission")}>Next</button></div>
      </OnboardingDialog>
    );
  }
  return (
    <OnboardingDialog open={open} title="Your mission">
      <p>Your app is ready. Now run one patient through it, the way your customers will:</p>
      <ol className="mission">
        <li><strong>Request care as a patient.</strong> Pick a program and answer its intake. That creates the patient, a care plan and an encounter in Lithos.</li>
        <li><strong>Play the clinician.</strong> On the care page, approve, decline or ask the patient a question. In production a licensed Lithos clinician decides.</li>
        <li><strong>See what your patient sees.</strong> The patient app: the prescription and its delivery, the plan, a chat with the care team.</li>
        <li><strong>Hear about it.</strong> Set up webhooks, so your app learns the moment anything changes.</li>
      </ol>
      <p className="muted">The bar at the top of every page keeps track and links to the next step. Your Lithos console ticks as you go.</p>
      <form action={finishOnboardingAction} className="form-actions">
        <button type="submit" className="btn btn-primary">Go to my app</button>
        <button type="button" className="btn btn-ghost" onClick={() => setStage("brand")}>Back</button>
      </form>
    </OnboardingDialog>
  );
}
