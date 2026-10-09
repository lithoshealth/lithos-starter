import { cookies } from "next/headers";
import { configWritable, readConfig } from "@/lib/starter-config";
import { lithosConnection } from "@/lib/lithos/connection";
import { readHandoff } from "@/lib/setup/handoff";
import { readProgramOptions } from "@/lib/setup/steps";
import { BrandPanel } from "../(dev)/setup/brand-panel";
import { ConnectForm, ProgramPicker } from "../(dev)/setup/step-actions";
import { ONBOARDING_COOKIE } from "./onboarding-cookie";
import { OnboardingDialog, StartUsingApp } from "./onboarding-dialog";

/**
 * Development only: the first thing someone sees after `npm run dev`. Two
 * stages, in one pop-up over the home page: connect to Lithos (the client ID
 * and secret from your console, or new sandbox credentials), then make it
 * yours (the program you offer, your brand). After that, the app itself is
 * the walkthrough: the dev bar says what's next.
 */
export async function Onboarding() {
  const seen = (await cookies()).get(ONBOARDING_COOKIE)?.value;
  const connected = lithosConnection().connected;
  const config = await readConfig();

  if (!connected) {
    const handoff = await readHandoff();
    return (
      <OnboardingDialog open={seen !== "later"} title="Connect this app to Lithos">
        <p>
          Paste the client ID and secret from your Lithos console, so its sandbox checklist ticks as this app makes the
          calls. They&rsquo;re checked with Lithos, then kept in <code>.env.local</code> on your server.
        </p>
        <ConnectForm companyName={config.brand.name} email={handoff?.email} handedOver={Boolean(handoff)} />
      </OnboardingDialog>
    );
  }

  if (seen === "done") return null;
  const programs = config.program ? null : await readProgramOptions().catch(() => null);
  return (
    <OnboardingDialog open={seen !== "later"} title="Make it yours">
      {programs ? (
        <>
          <p>Connected. Which program does this app offer? It decides what your site says and the intake your patients answer.</p>
          <ProgramPicker programs={programs} />
        </>
      ) : (
        <>
          <p>Connected. Give the app your name, colour and logo, now or later from the Developer page.</p>
          <BrandPanel brand={config.brand} program={config.program} writable={configWritable()} />
          <div>
            <StartUsingApp />
          </div>
        </>
      )}
    </OnboardingDialog>
  );
}
