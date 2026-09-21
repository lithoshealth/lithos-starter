import type { Metadata } from "next";
import { isDbConfigured } from "@/lib/db";
import { MembershipUnavailable } from "../membership-unavailable";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join Eucardia" };
// Dynamic on purpose: whether signups are available depends on DATABASE_URL at
// request time. Prerendered, a build without it would bake in "unavailable".
export const dynamic = "force-dynamic";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  if (!isDbConfigured()) return <MembershipUnavailable />;

  const { plan } = await searchParams;
  const initialPlan = plan === "essential" ? "essential" : "complete";

  return (
    <section className="form-card stack">
      <p className="eyebrow">Membership</p>
      <h1>Join Eucardia.</h1>
      <p className="lede">
        Your first panel ships as soon as you join. Your coach reads it with you, and you go from there.
      </p>
      <p className="demo-note">
        <strong>Demo environment.</strong> No card is charged and no panel ships. Please use sample details, not a real
        person&rsquo;s.
      </p>
      <JoinForm initialPlan={initialPlan} />
    </section>
  );
}
