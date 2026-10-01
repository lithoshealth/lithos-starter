import { sandboxOpsOnly } from "@/lib/ops-guard";
import type { Metadata } from "next";
import Link from "next/link";
import { isDbConfigured } from "@/lib/db";
import { listMembers } from "@/lib/members";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";

function ldlGap(latest: string | null, target: string | null): { text: string; tone: string } {
  if (latest === null) return { text: "no panel", tone: "badge-outline" };
  if (target === null) return { text: `${Number(latest)} mg/dL`, tone: "badge-outline" };
  const gap = Number(latest) - Number(target);
  if (gap <= 0) return { text: `${Number(latest)} · at goal`, tone: "badge-success" };
  return { text: `${Number(latest)} · ${gap.toFixed(0)} above`, tone: gap > 40 ? "badge-error" : "badge-warning" };
}

export default async function MembersPage() {
  sandboxOpsOnly();
  if (!isDbConfigured()) {
    return <section className="panel stack"><h1>Members</h1><p className="empty-state">DATABASE_URL isn’t set — run <code>./scripts/db-up.sh</code>.</p></section>;
  }
  const members = await listMembers();

  return (
    <section className="panel stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Eucardia’s own record</p>
          <h1>Members</h1>
        </div>
      </div>
      <p className="muted">Everyone here existed before Lithos saw them. The last column is the link: null until a member is escalated to medical care.</p>
      <div className="table-scroll">
        <table className="journeys-table">
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Plan</th>
              <th scope="col">Coach</th>
              <th scope="col">Latest LDL-C vs target</th>
              <th scope="col">Panels</th>
              <th scope="col">Lithos</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const gap = ldlGap(m.latest_ldl, m.ldl_c_target);
              return (
                <tr key={m.id}>
                  <td>
                    <Link href={`/members/${encodeURIComponent(m.id)}`}><strong>{m.first_name} {m.last_name}</strong></Link>
                    <code className="secondary-id">{m.id}</code>
                  </td>
                  <td>{m.plan ?? "care only"} <span className={`badge ${m.status === "active" ? "badge-success" : "badge-outline"}`}>{m.status}</span></td>
                  <td>{m.coach_name ?? <span className="muted">—</span>}</td>
                  <td><span className={`badge ${gap.tone}`}>{gap.text}</span></td>
                  <td>{m.panel_count}</td>
                  <td>{m.lithos_patient_id ? <code className="secondary-id">{m.lithos_patient_id}</code> : <span className="muted">not linked</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
