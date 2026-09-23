import type { Metadata } from "next";
import { getSite } from "@/lib/app-meta";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = { title: "Start a care review" };

export default async function StartPage() {
  const { brand, program, content } = await getSite();
  return (
    <section className="form-card stack">
      <p className="eyebrow">About 2 minutes</p>
      <h1>{content.start.heading}</h1>
      <p className="lede">{content.start.lede}</p>
      <p className="demo-note"><strong>Demo environment.</strong> This build runs against a sandbox — please use sample patient details, not real ones.</p>
      {/* Keyed by program, so switching it in /setup starts the quiz fresh rather than mid-way through the other one. */}
      <IntakeForm key={program} brandName={brand.name} program={program} />
    </section>
  );
}
