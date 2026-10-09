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

/** The last button of the pop-up: you're set, into the app. */
export function StartUsingApp() {
  return (
    <form action={finishOnboardingAction}>
      <button type="submit" className="btn btn-primary">Start using your app: request care as a patient</button>
    </form>
  );
}
