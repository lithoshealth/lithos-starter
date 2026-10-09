"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ONBOARDING_COOKIE } from "./onboarding-cookie";
import { onboardingDoneValue } from "./onboarding-done";
import { readConfig, updateConfig } from "@/lib/starter-config";
import { readOfferedPrograms } from "@/lib/setup/steps";

/**
 * The pop-up's last button: remember the app is set up, and go request care
 * as a patient. Done on the server, so the layout (where the pop-up lives)
 * re-renders without it — a client-side cookie and navigation leaves the
 * layout as it was.
 */
export async function finishOnboardingAction(): Promise<void> {
  // The home page talks about one program: the first one offered, unless one is set already.
  if (!(await readConfig()).program) {
    const first = (await readOfferedPrograms().catch(() => []))[0];
    if (first) await updateConfig({ program: first.key });
  }
  (await cookies()).set(ONBOARDING_COOKIE, onboardingDoneValue(), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect("/start");
}
