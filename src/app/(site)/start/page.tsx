import type { Metadata } from "next";
import Link from "next/link";
import { getSite } from "@/lib/app-meta";
import { contentFor } from "@/lib/programs/content";
import { programFor } from "@/lib/setup/programs";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = { title: "Start a care review" };

/**
 * The care review. The app offers every program in the organization's
 * formulary; with more than one, the patient picks first (`?program=`), and
 * the intake is that program's. Not connected, it's the home page's program —
 * the form still works, and submitting says what's missing.
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const site = await getSite();
  const { brand, intakeStyle } = site;
  const asked = (await searchParams).program;
  let program = site.program;
  if (site.multi) {
    const picked = site.programs.find((key) => key === asked);
    if (!picked) return <ProgramChoice brandName={brand.name} programs={site.programs} />;
    program = picked;
  }
  const content = contentFor(program);
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

function ProgramChoice({ brandName, programs }: { brandName: string; programs: string[] }) {
  return (
    <section className="form-card stack">
      <p className="eyebrow">About 2 minutes</p>
      <h1>What can {brandName} help you with?</h1>
      <p className="lede">Pick one to start. A clinician licensed in your state reviews every answer and decides on treatment.</p>
      <div className="quiz-options">
        {programs.map((key) => (
          <Link key={key} href={`/start?program=${key}`} className="quiz-option program-choice">
            <strong>{programFor(key)?.label}</strong>
            <span className="muted">{contentFor(key).description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
