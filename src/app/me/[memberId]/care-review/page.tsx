import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { getMemberRecord } from "@/lib/members";
import { MembershipUnavailable } from "../../../membership-unavailable";
import { CareReviewForm } from "./care-review-form";

export const metadata: Metadata = { title: "Start a care review" };
export const dynamic = "force-dynamic";

function isoDate(value: string | Date): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export default async function CareReviewPage({ params }: { params: Promise<{ memberId: string }> }) {
  if (!isDbConfigured()) return <MembershipUnavailable />;

  const { memberId } = await params;
  const record = await getMemberRecord(memberId);
  if (!record) notFound();

  const { member, panels } = record;
  const latest = panels[0];

  // Lithos requires an LDL-C on the intake, so a member with no panel at all
  // can't be escalated. Say so here rather than failing at the API.
  if (!latest?.ldl_c) {
    return (
      <section className="form-card stack">
        <p className="eyebrow">Care review</p>
        <h1>We need a panel first.</h1>
        <p className="lede">
          A clinician can&rsquo;t review your cholesterol without a result to read. Your first panel is on its way —
          once it lands, this page will let you continue.
        </p>
        <p><Link href={`/me/${encodeURIComponent(member.id)}`} className="btn btn-ghost">Back to your dashboard</Link></p>
      </section>
    );
  }

  return (
    <section className="form-card stack">
      <p className="eyebrow">Care review</p>
      <h1>Ask a clinician to look at your numbers.</h1>
      <p className="lede">
        Your most recent LDL-C is <strong>{latest.ldl_c} mg/dL</strong>, drawn {isoDate(latest.drawn_on)}. A clinician
        licensed in your state will read it alongside your history and decide with you what to do next.
      </p>
      <p className="demo-note">
        <strong>Demo environment.</strong> This goes to a sandbox. No real clinician reviews it and no medication ships.
      </p>
      <CareReviewForm memberId={member.id} askInsurance={member.enrolled_in_government_insurance === null} />
    </section>
  );
}
