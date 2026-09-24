import Link from "next/link";
import { getSite } from "@/lib/app-meta";
import { withName } from "@/lib/programs/content";
import { DEFAULT_CONFIG } from "@/lib/starter-config";

// Kept for the ops "Journeys" page, which links back here.
export function HomePageLinks() {
  return <p><Link href="/journeys">View all journeys</Link></p>;
}

/**
 * The home page. Every line of copy comes from the program chosen in /setup
 * (src/lib/programs/content.ts), with the company name from the brand — so
 * the same page sells lipid care or weight loss, under the prospect's name.
 */
export default async function HomePage() {
  const { brand, content: c } = await getSite();
  const name = brand.name;
  // The company's own tagline (typed, or imported from their site) is the
  // headline; the demo brand's placeholder isn't, so the program's line is.
  const headline = brand.tagline !== DEFAULT_CONFIG.brand.tagline ? brand.tagline : c.hero.headline;
  const planHref = (plan: string) => (c.plansLeadTo === "join" ? `/join?plan=${plan.toLowerCase()}` : "/start");

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{c.category}</p>
          <h1>{headline}</h1>
          <p className="lede">{withName(c.hero.lede, name)}</p>
          <div className="hero-actions">
            {/* Care review first: it's the path that exercises the Lithos API end to end. */}
            <Link href="/start" className="btn btn-primary btn-lg">Start a care review</Link>
            <Link href="#plans" className="btn btn-ghost btn-lg">See plans</Link>
          </div>
          <ul className="trust">
            {c.hero.trust.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
        <aside className="hero-card" aria-label={c.hero.includesTitle}>
          <h3>{c.hero.includesTitle}</h3>
          <ul className="checklist">
            {c.hero.includes.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </aside>
      </section>

      <section className="section" id="program">
        <div className="section-head">
          <p className="eyebrow">{c.program.eyebrow}</p>
          <h2>{c.program.headline}</h2>
          <p className="lede">{c.program.lede}</p>
        </div>
        <ol className="steps quarter-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {c.program.phases.map((phase, index) => (
            <li key={phase.title} className="card">
              <span className="step-num" aria-hidden="true">{index + 1}</span>
              <p className="eyebrow">{phase.when}</p>
              <h3>{phase.title}</h3>
              <p>{phase.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" id="coaching">
        <div className="section-head">
          <p className="eyebrow">{c.coaching.eyebrow}</p>
          <h2>{c.coaching.headline}</h2>
          <p className="lede">{c.coaching.lede}</p>
        </div>
        <div className="grid-4">
          {c.coaching.focuses.map((item) => (
            <div key={item.name} className="card">
              <span className="number">{item.name}</span>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="numbers">
        <div className="section-head">
          <p className="eyebrow">What we measure</p>
          <h2>{c.numbers.headline}</h2>
          <p className="lede">{c.numbers.lede}</p>
        </div>
        <div className="grid-3">
          {c.numbers.items.map((item) => (
            <div key={item.name} className="card">
              <span className="number">{item.name}</span>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="care">
        <div className="section-head">
          <p className="eyebrow">Care from licensed clinicians</p>
          <h2>{c.care.headline}</h2>
        </div>
        <div className="split">
          <div>
            {c.care.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <p className="fine-print">
              Care is delivered by licensed clinicians. Medication costs are separate; we&rsquo;ll tell you what
              something costs before it ships.
            </p>
          </div>
          <aside className="hero-card" aria-label="What a care review involves">
            <h3>What a care review involves</h3>
            <ul className="checklist">
              {c.care.reviewIncludes.map((line) => <li key={line}>{line}</li>)}
            </ul>
            <p style={{ marginTop: "1rem" }}>
              <Link href="/start" className="btn btn-primary">Start a care review</Link>
            </p>
          </aside>
        </div>
      </section>

      <section className="section" id="plans">
        <div className="section-head">
          <p className="eyebrow">Plans</p>
          <h2>{c.plans.headline}</h2>
        </div>
        <div className="grid-2">
          {c.plans.items.map((plan) => (
            <div key={plan.name} className={plan.featured ? "card card-featured" : "card"}>
              {plan.featured ? <span className="pill">Most members</span> : null}
              <span className="number">{plan.name}</span>
              <p className="price"><strong>{plan.price}</strong> <span>/ month</span></p>
              <p>{plan.tagline}</p>
              <ul className="checklist" style={{ marginTop: "0.5rem" }}>
                {plan.includes.map((line) => <li key={line}>{line}</li>)}
              </ul>
              <p style={{ marginTop: "0.75rem" }}>
                <Link href={planHref(plan.name)} className={plan.featured ? "btn btn-primary" : "btn btn-ghost"}>
                  {c.plansLeadTo === "join" ? `Join ${plan.name}` : `Start with ${plan.name}`}
                </Link>
              </p>
            </div>
          ))}
        </div>
        <p className="fine-print" style={{ marginTop: "1rem" }}>{c.plans.note}</p>
      </section>

      <section className="section" id="who">
        <div className="section-head">
          <p className="eyebrow">Who {name} is for</p>
          <h2>You&rsquo;ll recognize yourself in one of these.</h2>
        </div>
        <ul className="checklist" style={{ maxWidth: "44rem" }}>
          {c.audiences.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <div className="cta-band">
          <div>
            <h2>{c.cta.headline}</h2>
            <p>{c.cta.body}</p>
          </div>
          <Link href={c.plansLeadTo === "join" ? "/join" : "/start"} className="btn btn-primary btn-lg">
            {c.plansLeadTo === "join" ? `Join ${name}` : "Get started"}
          </Link>
        </div>
        <p className="fine-print" style={{ marginTop: "1rem" }}>{withName(c.emergency, name)}</p>
      </section>
    </>
  );
}
