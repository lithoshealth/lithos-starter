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
      {/* Lithos's protocols are subject to its clinical team's final review — say so wherever their intake shows. */}
      <p className="demo-note">
        <strong>Illustrative intake.</strong>{" "}
        {programFor(program)?.illustrative
          ? <>This starter doesn&rsquo;t have the {programFor(program)?.label.toLowerCase()} intake yet, so it asks a few general questions instead; Lithos&rsquo;s intake schema for the program decides what the API accepts.</>
          : <>These are the questions Lithos&rsquo;s {programFor(program)?.label.toLowerCase()} protocol asks in the sandbox.</>}{" "}
        Protocols and their intake are subject to final review and approval by Lithos&rsquo;s clinical team.
      </p>
      {/* Keyed by program and style, so switching either in /setup starts the intake fresh. */}
      <IntakeForm key={`${program}-${intakeStyle}`} brandName={brand.name} program={program} style={intakeStyle} />
    </section>
  );
}
