import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBrand } from "@/lib/app-meta";
import { supportAnswers } from "@/lib/portal/support";
import { newestPlan } from "@/lib/portal/view";
import { Icon } from "../icons";
import { portalPageState } from "../page-state";
import { PortalShell } from "../shell";

export const metadata: Metadata = { title: "Help & support" };
export const dynamic = "force-dynamic";

/** Support: quick answers (the partner's own content), and the care team for anything else. */
export default async function Support() {
  const state = await portalPageState();
  if (state.kind === "screen") return state.screen;
  if (state.kind === "signed_out") redirect("/portal");
  const brand = await getBrand();
  const answers = supportAnswers(brand.name, newestPlan(state.data)?.category);

  return (
    <PortalShell tab="support" data={state.data} eyebrow="We've got you" title="Help & support" lede="Quick answers to common questions, and a real person when you need one.">
      <section className="faq" aria-label="Common questions">
        {answers.map((a) => (
          <details key={a.question} className="faq-item">
            <summary>
              <span><strong>{a.question}</strong><span className="card-label">{a.topic}</span></span>
              <Icon name="chevron" />
            </summary>
            <p>{a.answer}</p>
          </details>
        ))}
        <div className="faq-human">
          <span>Need a person? Your care team is a message away.</span>
          <Link href="/portal/messages" className="btn btn-ghost">Contact</Link>
        </div>
      </section>
    </PortalShell>
  );
}
