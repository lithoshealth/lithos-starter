"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ONBOARDING_COOKIE } from "./onboarding-cookie";
import { onboardingDoneValue } from "./onboarding-done";

/**
 * The pop-up's last button: remember the app is set up, and land on the home
 * page — the mission is on the screen before it, and the bar keeps track.
 * Done on the server, so the layout (where the pop-up lives) re-renders
 * without it — a client-side cookie and navigation leaves the layout as it was.
 */
export async function finishOnboardingAction(): Promise<void> {
  (await cookies()).set(ONBOARDING_COOKIE, onboardingDoneValue(), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect("/");
}
