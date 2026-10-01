import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { getMemberCare, getMemberRecord } from "@/lib/members";
import { MembershipUnavailable } from "../../membership-unavailable";

export const metadata: Metadata = { title: "Your membership" };
export const dynamic = "force-dynamic";

const CARE_STATUS: Record<string, { label: string; badge: string; detail: string }> = {
  pending_review: { label: "With a clinician", badge: "badge-info", detail: "Your care review is in the queue. We'll let you know as soon as it's been read." },
  in_review: { label: "Being reviewed", badge: "badge-warning", detail: "A clinician is reading your history right now." },
  escalated: { label: "A question for you", badge: "badge-warning", detail: "Your clinician has asked something before they can decide." },
  completed: { label: "Plan ready", badge: "badge-success", detail: "Your clinician has finished reviewing. Your plan is on your care page." },
  canceled: { label: "Closed", badge: "badge-outline", detail: "This review was closed." },
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const text = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysSince(value: string | Date): number {
  const text = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const [y, m, d] = text.split("-").map(Number);
  return Math.floor((Date.now() - new Date(y, m - 1, d).getTime()) / 86_400_000);
}

export default async function MemberHomePage({ params }: { params: Promise<{ memberId: string }> }) {
  if (!isDbConfigured()) return <MembershipUnavailable />;

  const { memberId } = await params;
  const record = await getMemberRecord(memberId);
  if (!record) notFound();

  const { member, panels, target, notes } = record;
  const care = member.lithos_patient_id ? await getMemberCare(member.id) : null;
  const encounter = care?.encounters[0] ?? null;
  const status = encounter ? CARE_STATUS[encounter.status] ?? CARE_STATUS.pending_review : null;
  const latest = panels[0];
  const planLabel = member.plan === "complete" ? "Complete" : member.plan === "essential" ? "Essential" : "No membership";

  // Twelve weeks from the last panel is the re-test the program is built around.
  const daysIntoQuarter = latest ? daysSince(latest.drawn_on) : null;
  const daysToNextPanel = daysIntoQuarter === null ? null : 84 - daysIntoQuarter;

  return (
    <section className="stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{member.plan ? `${planLabel} membership` : planLabel} · {member.status}</p>
          <h1>Hello, {member.first_name}.</h1>
          <p className="muted">
            Member since {formatDate(member.joined_at)}
            {member.coach_name ? ` · your coach is ${member.coach_name}` : ""}
          </p>
        </div>
        <Link href="/" className="btn btn-ghost">Eucardia home</Link>
      </div>

      <div className="grid-2">
        <div className="card">
          <span className="number">Your numbers</span>
          {latest ? (
            <>
              <p>
                <strong>LDL-C {latest.ldl_c ?? "—"} mg/dL</strong>
                <span className="muted"> · drawn {formatDate(latest.drawn_on)}</span>
              </p>
              <p className="muted">
                {target?.ldl_c_target
                  ? `Your target is under ${target.ldl_c_target} mg/dL.`
                  : "Your coach will set a target with you once you've talked through this panel."}
              </p>
              {daysToNextPanel !== null && (
                <p className="muted">
                  {daysToNextPanel > 0
                    ? `Next panel in about ${daysToNextPanel} days — day ${daysIntoQuarter} of this quarter.`
                    : "Your next panel is due — we'll send a kit."}
                </p>
              )}
            </>
          ) : (
            <p className="muted">Your first panel is on its way. Your quarter starts the day the result lands.</p>
          )}
        </div>

        <div className="card">
          <span className="number">Medical care</span>
          {status && encounter ? (
            <>
              <p><span className={`badge ${status.badge}`}>{status.label}</span></p>
              <p className="muted">{status.detail}</p>
              <p style={{ marginTop: "0.5rem" }}>
                <Link href={`/care/${encodeURIComponent(encounter.lithos_encounter_id)}`} className="btn btn-primary">
                  Open your care page
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="muted">
                You&rsquo;re on the coaching side of Eucardia — no clinician is involved, and nothing about you has left
                our records.
              </p>
              <p className="muted">
                If your numbers aren&rsquo;t moving, or your coach suggests it, you can ask a clinician to take a look.
              </p>
              <p style={{ marginTop: "0.5rem" }}>
                <Link href={`/me/${encodeURIComponent(member.id)}/care-review`} className="btn btn-primary">
                  Start a care review
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {panels.length > 0 && (
        <div className="form-section">
          <h2>Your panels</h2>
          <div className="table-scroll">
            <table className="journeys-table">
              <thead>
                <tr><th>Drawn</th><th>LDL-C</th><th>ApoB</th><th>Lp(a)</th><th>Total</th><th>Where it came from</th></tr>
              </thead>
              <tbody>
                {panels.map((panel) => (
                  <tr key={panel.id}>
                    <td>{formatDate(panel.drawn_on)}</td>
                    <td><strong>{panel.ldl_c ?? "—"}</strong></td>
                    <td>{panel.apo_b ?? "—"}</td>
                    <td>{panel.lp_a ?? "—"}</td>
                    <td>{panel.total_cholesterol ?? "—"}</td>
                    <td className="muted">
                      {panel.source === "eucardia" ? "Eucardia quarterly panel" : panel.source === "lithos" ? "Ordered by your clinician" : "Brought with you"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="form-section">
          <h2>From your coach</h2>
          <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
            {notes.slice(0, 4).map((note) => (
              <li key={note.id}>
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  {formatDate(note.occurred_at)} · {note.focus} · {note.author}
                </p>
                <p>{note.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
