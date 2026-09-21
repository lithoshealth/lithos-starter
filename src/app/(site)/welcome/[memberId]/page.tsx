import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { getJoinedMember } from "@/lib/join";
import { MembershipUnavailable } from "../../membership-unavailable";

export const metadata: Metadata = { title: "Welcome to Eucardia" };
export const dynamic = "force-dynamic";

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  const text = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function WelcomePage({ params }: { params: Promise<{ memberId: string }> }) {
  if (!isDbConfigured()) return <MembershipUnavailable />;

  const { memberId } = await params;
  const record = await getJoinedMember(memberId);
  if (!record) notFound();

  const { member, priorLdl, priorDrawnOn } = record;
  const planLabel = member.plan === "complete" ? "Complete" : "Essential";

  return (
    <section className="form-card stack">
      <p className="eyebrow">You&rsquo;re in</p>
      <h1>Welcome, {member.first_name}.</h1>
      <p className="lede">
        Your {planLabel} membership is active. Your first at-home panel ships this week — your quarter starts the day
        the result lands.
      </p>

      <div className="form-section">
        <h2>What happens next</h2>
        <ol className="stack" style={{ paddingLeft: "1.1rem" }}>
          <li><strong>This week.</strong> Your kit arrives. Collect the sample at home and drop it in the mail.</li>
          <li><strong>About a week later.</strong> Your results land in the app, with every marker explained.</li>
          <li>
            <strong>Then.</strong> {member.coach_name ?? "Your coach"} reads them with you and you set one or two
            targets together. Weekly check-ins from there, and a re-test at twelve weeks.
          </li>
        </ol>
      </div>

      <div className="form-section">
        <h2>Your membership</h2>
        <dl className="status-meta">
          <div><dt>Member</dt><dd>{member.first_name} {member.last_name}</dd></div>
          <div><dt>Plan</dt><dd>{planLabel}</dd></div>
          <div><dt>Coach</dt><dd>{member.coach_name ?? "Being assigned"}</dd></div>
          <div><dt>Member since</dt><dd>{formatDate(member.joined_at)}</dd></div>
          <div><dt>Member ID</dt><dd><code>{member.id}</code></dd></div>
          {priorLdl && (
            <div><dt>Starting LDL-C</dt><dd>{priorLdl} mg/dL <span className="muted">drawn {formatDate(priorDrawnOn)}</span></dd></div>
          )}
        </dl>
      </div>

      {/*
        The demo's actual payload. A visitor sees a welcome page; the point for
        anyone evaluating the integration is what did NOT happen: no Lithos
        patient, no care plan, no encounter. This member is Eucardia's alone
        until somebody decides they need care.
      */}
      <div className="demo-note">
        <p>
          <strong>Nothing has been sent to Lithos.</strong> This member exists only in Eucardia&rsquo;s own database —
          no patient, no care plan, no encounter. That is the normal state for most members, and it is what a partner
          arriving with an existing user base looks like.
        </p>
        <p style={{ marginTop: "0.6rem" }}>
          The operator&rsquo;s view of the same member — including what would and wouldn&rsquo;t carry into a Lithos
          intake — is at <Link href={`/members/${encodeURIComponent(member.id)}`}>their member record</Link>.
        </p>
      </div>

      <p>
        <Link href={`/me/${encodeURIComponent(member.id)}`} className="btn btn-primary btn-lg">Go to your dashboard</Link>
      </p>
    </section>
  );
}
