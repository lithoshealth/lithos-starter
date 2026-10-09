import type { Metadata } from "next";
import { getSite } from "@/lib/app-meta";
import { programFor } from "@/lib/setup/programs";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = { title: "Start a care review" };

export default async function StartPage() {
  const { brand, program, intakeStyle, content } = await getSite();
  return (
    <section className="form-card stack">
      <p className="eyebrow">About 2 minutes</p>
      <h1>{content.start.heading}</h1>
      <p className="lede">{content.start.lede}</p>
      <p className="demo-note"><strong>Demo environment.</strong> This build runs against a sandbox — please use sample patient details, not real ones.</p>
      {programFor(program)?.illustrative && (
        <p className="demo-note">
          <strong>Illustrative intake.</strong> This starter doesn&rsquo;t have the real {programFor(program)?.label.toLowerCase()} intake yet, so it asks a few general questions instead. Lithos&rsquo;s intake schema for this program decides what the API accepts.
        </p>
      )}
      {/* Keyed by program and style, so switching either in /setup starts the intake fresh. */}
      <IntakeForm key={`${program}-${intakeStyle}`} brandName={brand.name} program={program} style={intakeStyle} />
    </section>
  );
}
