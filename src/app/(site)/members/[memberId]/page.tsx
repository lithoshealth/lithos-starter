import { sandboxOpsOnly } from "@/lib/ops-guard";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildEscalationPlan } from "@/lib/escalation";
import { getMemberCare, getMemberRecord } from "@/lib/members";
import { EscalateForm } from "./escalate-form";
import { InquiryThread } from "./inquiry-thread";

export const metadata: Metadata = { title: "Member" };
export const dynamic = "force-dynamic";

const n = (v: string | null) => (v === null ? "—" : String(Number(v)));
const d = (v: string | Date | null) => (v ? (typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10)) : "—");
const when = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—");

const ENCOUNTER_LABEL: Record<string, [string, string]> = {
  pending_review: ["Received — awaiting a clinician", "badge-info"],
  in_review: ["A clinician is reviewing", "badge-warning"],
  escalated: ["The clinician has a question", "badge-warning"],
  completed: ["Reviewed", "badge-success"],
  canceled: ["Canceled", "badge-outline"],
};

export default async function MemberPage({ params }: { params: Promise<{ memberId: string }> }) {
  sandboxOpsOnly();
  const { memberId } = await params;
  const record = await getMemberRecord(memberId);
  if (!record) notFound();
  const { member, panels, target, notes } = record;
  const care = await getMemberCare(memberId);
  const plan = panels.length > 0 ? buildEscalationPlan(record) : null;
  const linked = Boolean(member.lithos_patient_id);
  const openEncounter = care.encounters.find((e) => ["pending_review", "in_review", "escalated"].includes(e.status));
  const activePlan = care.carePlans.find((p) => p.status === "active");
  const ascvdDefault = /ascvd|stent|revasculari|\bmi\b|cabg|stroke|\btia\b/i.test(target?.rationale ?? "");

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Member · {member.plan} plan · {member.status}</p>
            <h1>{member.first_name} {member.last_name}</h1>
            <p className="muted">Joined {d(member.joined_at as unknown as string)} · coach {member.coach_name ?? "—"} · <code>{member.id}</code></p>
          </div>
          <Link href="/members" className="btn btn-ghost">All members</Link>
        </div>

        <dl className="status-meta">
          <div><dt>Latest LDL-C</dt><dd>{panels[0] ? `${n(panels[0].ldl_c)} mg/dL on ${d(panels[0].drawn_on)}` : "—"}</dd></div>
          <div><dt>Eucardia target</dt><dd>{target ? `LDL-C ${n(target.ldl_c_target)} · ApoB ${n(target.apo_b_target)}` : "—"}</dd></div>
          <div><dt>Lithos patient</dt><dd>{linked ? <code>{member.lithos_patient_id}</code> : <span className="muted">not linked</span>}</dd></div>
          <div><dt>Care status</dt><dd>{openEncounter ? <span className={`badge ${ENCOUNTER_LABEL[openEncounter.status]?.[1] ?? "badge-outline"}`}>{ENCOUNTER_LABEL[openEncounter.status]?.[0] ?? openEncounter.status}</span> : activePlan ? <span className="badge badge-success">Treatment plan active</span> : <span className="muted">coaching only</span>}</dd></div>
        </dl>
        {target?.rationale && <p className="muted">{target.rationale}</p>}
      </section>

      {care.inquiries.filter((i) => i.status === "open" && i.awaiting === "patient").map((i) => (
        <InquiryThread key={i.lithos_inquiry_id} memberId={member.id} inquiry={i.raw} />
      ))}

      <section className="panel stack">
        <h2>Lab history <span className="muted">— Eucardia’s own panels</span></h2>
        <div className="table-scroll">
          <table className="journeys-table">
            <thead><tr><th>Drawn</th><th>LDL-C</th><th>ApoB</th><th>Lp(a)</th><th>HDL</th><th>TG</th><th>Total</th><th>hs-CRP</th><th>HbA1c</th><th>Note</th></tr></thead>
            <tbody>
              {panels.map((p) => (
                <tr key={p.id}>
                  <td>{d(p.drawn_on)} <span className="muted">{p.source !== "eucardia" ? p.source : ""}</span></td>
                  <td><strong>{n(p.ldl_c)}</strong></td><td>{n(p.apo_b)}</td><td>{n(p.lp_a)}</td><td>{n(p.hdl_c)}</td><td>{n(p.triglycerides)}</td><td>{n(p.total_cholesterol)}</td><td>{n(p.hs_crp)}</td><td>{n(p.a1c)}</td>
                  <td className="muted">{p.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {notes.length > 0 && (
        <section className="panel stack">
          <h2>Coaching notes</h2>
          {notes.map((note) => (
            <div key={note.id} className="event">
              <p><strong>{note.author}</strong> · <span className="muted">{d(note.occurred_at)} · {note.focus}</span></p>
              <p>{note.summary}</p>
            </div>
          ))}
        </section>
      )}

      {linked && (
        <section className="panel stack">
          <h2>Medical care <span className="muted">— what Lithos has told us</span></h2>
          {care.encounters.length === 0 && <p className="empty-state">Linked, but no encounter projected yet.</p>}
          {care.encounters.map((e) => (
            <div key={e.lithos_encounter_id} className="event">
              <p><strong>{e.encounter_type === "follow_up" ? "Follow-up" : "Initial"} encounter</strong> <span className={`badge ${ENCOUNTER_LABEL[e.status]?.[1] ?? "badge-outline"}`}>{ENCOUNTER_LABEL[e.status]?.[0] ?? e.status}</span></p>
              <p className="muted">Submitted {when(e.lithos_created_at)}{e.completed_at ? ` · reviewed ${when(e.completed_at)}` : ""} · <code>{e.lithos_encounter_id}</code> · <Link href={`/care/${encodeURIComponent(e.lithos_encounter_id)}`}>member view</Link></p>
              {e.raw.requested_treatments?.length > 0 && (
                <p>Requested: {e.raw.requested_treatments.map((t) => `${t.catalog_treatment_id ?? "clinician’s choice"} (${t.status})`).join(", ")}</p>
              )}
            </div>
          ))}
          {activePlan && activePlan.raw.treatments?.length > 0 && (
            <div className="notes">
              <strong>Active treatment</strong>
              {activePlan.raw.treatments.map((t) => (
                <p key={t.treatment_id}>
                  {t.catalog_treatment_id}{t.current_prescription ? ` — ${t.current_prescription.strength}, ${t.current_prescription.instructions}` : ""}
                  <br /><span className="muted">refill {t.refill_status}{t.refill_due_at ? ` · due ${d(t.refill_due_at)}` : ""} · <code>{t.treatment_id}</code></span>
                </p>
              ))}
            </div>
          )}
          {care.labRequisitions.map((r) => (
            <div key={r.lithos_lab_requisition_id} className="event">
              <p><strong>Lab order</strong> — {r.preset} <span className={`badge ${r.status === "approved" ? "badge-success" : "badge-outline"}`}>{r.status}</span></p>
              {r.download_url ? <p><a href={r.download_url} target="_blank" rel="noreferrer">Download the requisition PDF</a> <span className="muted">· take it to any Labcorp or Quest · link expires {when(r.download_expires_at)}</span></p> : <p className="muted">PDF {r.pdf_status ?? "pending"}.</p>}
            </div>
          ))}
          {care.orders.map((o) => (
            <p key={o.lithos_order_id} className="muted">Pharmacy order <code>{o.lithos_order_id}</code> · {o.status}</p>
          ))}
          {care.inquiries.filter((i) => !(i.status === "open" && i.awaiting === "patient")).map((i) => (
            <InquiryThread key={i.lithos_inquiry_id} memberId={member.id} inquiry={i.raw} />
          ))}
        </section>
      )}

      {plan && !openEncounter && !activePlan && (
        <section className="panel stack">
          <h2>{linked ? "New encounter" : "Escalate to medical care"}</h2>
          <details className="tech-details" open={!linked}>
            <summary>What Lithos will receive, and what it can’t</summary>
            <p><strong>Hard stops (partner-enforced):</strong> {plan.hardStops.map((h) => `${h.triggered ? "✗" : "✓"} ${h.rule}`).join(" · ")}</p>
            <p><strong>Declared fields:</strong> {plan.carried.map((c) => c.field).join(", ")}</p>
            <p><strong>Sent as undeclared extras</strong> (stored and shown, validated by nobody): {plan.sentUndeclared.map((c) => c.field).join(", ")}</p>
            <p><strong>Must be asked or drawn:</strong> {plan.mustAsk.map((a) => a.what).join(" · ")}</p>
          </details>
          <EscalateForm
            memberId={member.id}
            defaults={{ established_atherosclerotic_cardiovascular_disease: ascvdDefault }}
            governmentInsurance={member.enrolled_in_government_insurance}
          />
        </section>
      )}
    </div>
  );
}
