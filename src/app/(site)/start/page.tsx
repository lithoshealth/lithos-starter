import type { Metadata } from "next";
import { getBrand } from "@/lib/app-meta";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = { title: "Start a care review" };

export default async function StartPage() {
  const { name } = await getBrand();
  return (
    <section className="form-card stack">
      <p className="eyebrow">About 2 minutes</p>
      <h1>Let’s add medical care to your membership.</h1>
      <p className="lede">
        A care review is how coaching hands over to a clinician. Tell us about your history, what you’re taking now, and
        your most recent cholesterol results — a clinician licensed in your state reviews every one.
      </p>
      <p className="demo-note"><strong>Demo environment.</strong> This build runs against a sandbox — please use sample patient details, not real ones.</p>
      <IntakeForm brandName={name} />
    </section>
  );
}
