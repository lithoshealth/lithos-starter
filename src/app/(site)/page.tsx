import Link from "next/link";
import { getBrand } from "@/lib/app-meta";

// Kept for the ops "Journeys" page, which links back here.
export function HomePageLinks() {
  return <p><Link href="/journeys">View all journeys</Link></p>;
}

// The quarter is the unit of the membership: a panel opens it, a panel closes
// it, and the coaching in between is aimed at the numbers the next panel reads.
const quarter = [
  {
    when: "Week 1",
    title: "Your panel arrives",
    body: "An at-home kit, drawn wherever you are. LDL-C, ApoB, HDL, triglycerides, A1c — and Lp(a) once, because it only needs measuring once in your life.",
  },
  {
    when: "Week 2",
    title: "You and your coach read it together",
    body: "A call, not a PDF emailed into the void. You leave it with one or two targets written down and the reasoning behind them.",
  },
  {
    when: "Weeks 3–11",
    title: "One thing at a time",
    body: "Weekly check-ins in the app, each aimed at a single change. Nobody has ever fixed their cholesterol by being handed nine instructions at once.",
  },
  {
    when: "Week 12",
    title: "You re-test",
    body: "The next panel tells you whether it worked. If the numbers moved, we keep going. If they didn't, that's the moment to add medical care — not two years from now.",
  },
];

// These four are the coaching record's own categories — a coach note is filed
// under exactly one of them (`coach_notes.focus`), which is what makes a quarter
// reviewable instead of a pile of chat.
const focuses = [
  { name: "Diet", body: "Saturated fat and fibre, specifically — the two levers with the most evidence behind them for LDL-C. Not a meal plan you'll abandon in March." },
  { name: "Activity", body: "A floor you can actually hit on a bad week, raised slowly. Movement barely moves LDL-C on its own; it moves nearly everything else." },
  { name: "Sleep", body: "The one people skip. Short sleep undoes adherence, appetite and blood pressure at the same time, so we treat it as a lever, not a lifestyle bonus." },
  { name: "Adherence", body: "If you're on medication: taking it, taking it on time, and telling your coach the week side effects start — not at your next appointment." },
];

const numbers = [
  { name: "LDL-C", body: "The “bad” cholesterol most guidelines target. The number we treat to — and the one that tells us when lifestyle alone has gone as far as it can." },
  { name: "ApoB", body: "A count of the particles that actually drive plaque. Often a truer picture of risk than LDL-C alone, and it can stay high after LDL-C looks fine." },
  { name: "Lp(a)", body: "A largely inherited risk factor most people have never been tested for. Once is enough — and if it's high, it changes how aggressive we should be." },
];

const plans = [
  {
    name: "Essential",
    price: "$39",
    tagline: "The numbers, tracked and explained.",
    includes: [
      "A quarterly at-home lipid panel",
      "Habit tracking in the app",
      "A coach you can message, with a reply inside a working day",
      "Your full history in one place — every panel, every change",
    ],
  },
  {
    name: "Complete",
    price: "$89",
    tagline: "Coaching, plus care when you need it.",
    featured: true,
    includes: [
      "Everything in Essential",
      "The extended panel: ApoB and hs-CRP quarterly, Lp(a) once",
      "A named coach and a call at the start of every quarter",
      "Medical care included when lifestyle isn't getting you to target — clinician review, prescription, and follow-up labs",
    ],
  },
];

const audiences = [
  "Your LDL-C is high and you'd rather manage it than be told to watch it.",
  "Heart disease or high cholesterol runs in your family, and you want to know your real risk.",
  "You tried a statin, felt bad on it, and stopped — and nobody offered you an alternative.",
  "You get a panel once a year at a physical, and nothing happens between panels.",
];

export default async function HomePage() {
  const { name } = await getBrand();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Cardiometabolic membership</p>
          <h1>Know your numbers. Then actually move them.</h1>
          <p className="lede">
            {name} is a membership for people managing cholesterol and cardiovascular risk: a panel every quarter,
            a coach who reads it with you, and medical care added the moment lifestyle alone stops being enough.
          </p>
          <div className="hero-actions">
            {/* Care review first: it's the path that exercises the Lithos API end to end. */}
            <Link href="/start" className="btn btn-primary btn-lg">Start a care review</Link>
            <Link href="#plans" className="btn btn-ghost btn-lg">See membership plans</Link>
          </div>
          <ul className="trust">
            <li>Quarterly at-home panels</li>
            <li>A named coach, not a chatbot</li>
            <li>Prescribing when it&rsquo;s warranted — by licensed clinicians</li>
          </ul>
        </div>
        <aside className="hero-card" aria-label="What membership includes">
          <h3>What membership includes</h3>
          <ul className="checklist">
            <li>An at-home panel every quarter — LDL-C, ApoB, and Lp(a) once</li>
            <li>A coach who knows your history and your last four panels</li>
            <li>Targets written down, with the reasoning behind them</li>
            <li>Weekly check-ins aimed at one change at a time</li>
            <li>Medical care — clinician review, treatment, follow-up labs — when the numbers say so</li>
          </ul>
          <p className="fine-print" style={{ marginTop: "1rem" }}>
            Already a member and above target? <Link href="/start">Start a care review</Link>.
          </p>
        </aside>
      </section>

      <section className="section" id="program">
        <div className="section-head">
          <p className="eyebrow">The coaching program</p>
          <h2>A quarter at a time, because that&rsquo;s how fast the numbers answer.</h2>
          <p className="lede">
            Cholesterol doesn&rsquo;t respond to a week of effort, and it doesn&rsquo;t need a year to show whether
            something worked. Twelve weeks is roughly how long a real change takes to appear in a lipid panel, so that
            is the shape of the membership: test, decide, work, re-test.
          </p>
        </div>
        <ol className="steps quarter-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {quarter.map((phase, index) => (
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
          <p className="eyebrow">What a coach actually works on</p>
          <h2>Four levers, worked one at a time.</h2>
          <p className="lede">
            Your coach isn&rsquo;t a clinician and won&rsquo;t pretend to be one. Their job is the part that happens
            between panels — and to notice early when it isn&rsquo;t working.
          </p>
        </div>
        <div className="grid-4">
          {focuses.map((item) => (
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
          <h2>The three numbers we watch.</h2>
          <p className="lede">
            Most cholesterol care stops at one number, once a year. We track the ones that predict risk — and treat to a
            target rather than a guess.
          </p>
        </div>
        <div className="grid-3">
          {numbers.map((item) => (
            <div key={item.name} className="card">
              <span className="number">{item.name}</span>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="care">
        <div className="section-head">
          <p className="eyebrow">When lifestyle isn&rsquo;t enough</p>
          <h2>Medical care is part of the membership, not a different company.</h2>
        </div>
        <div className="split">
          <div>
            <p>
              For a lot of members, the panels and the coaching are the whole story. For some — familial
              hypercholesterolemia, a stubborn LDL-C, a statin that made them ache — they aren&rsquo;t. That is not a
              failure of effort, and it shouldn&rsquo;t mean starting again somewhere else.
            </p>
            <p>
              When a quarter ends above target, your coach can open a care review. A clinician licensed in your state
              reads your history — your panels, your medications, what you&rsquo;ve already tried — and decides with you
              what to add: a statin, ezetimibe, or a PCSK9 inhibitor where it&rsquo;s warranted. Prescriptions ship to
              your door, follow-up labs are ordered, and your coach keeps going through all of it.
            </p>
            <p className="fine-print">
              Care is delivered by licensed clinicians. Medication costs are separate from membership; we&rsquo;ll tell
              you what something costs before it ships.
            </p>
          </div>
          <aside className="hero-card" aria-label="What a care review involves">
            <h3>What a care review involves</h3>
            <ul className="checklist">
              <li>A short medical intake — history, current medications, anything you react to</li>
              <li>Clinician review against an evidence-based lipid protocol</li>
              <li>A treatment decision, and a message explaining it</li>
              <li>Follow-up labs and a recheck, usually at three months</li>
              <li>Refills handled without a new appointment</li>
            </ul>
            <p style={{ marginTop: "1rem" }}>
              <Link href="/start" className="btn btn-primary">Start a care review</Link>
            </p>
          </aside>
        </div>
      </section>

      <section className="section" id="plans">
        <div className="section-head">
          <p className="eyebrow">Membership</p>
          <h2>Two plans. Both start with a panel.</h2>
        </div>
        <div className="grid-2">
          {plans.map((plan) => (
            <div key={plan.name} className={plan.featured ? "card card-featured" : "card"}>
              {plan.featured ? <span className="pill">Most members</span> : null}
              <span className="number">{plan.name}</span>
              <p className="price"><strong>{plan.price}</strong> <span>/ month</span></p>
              <p>{plan.tagline}</p>
              <ul className="checklist" style={{ marginTop: "0.5rem" }}>
                {plan.includes.map((line) => <li key={line}>{line}</li>)}
              </ul>
              <p style={{ marginTop: "0.75rem" }}>
                <Link href={`/join?plan=${plan.name.toLowerCase()}`} className={plan.featured ? "btn btn-primary" : "btn btn-ghost"}>
                  Join {plan.name}
                </Link>
              </p>
            </div>
          ))}
        </div>
        <p className="fine-print" style={{ marginTop: "1rem" }}>
          Billed monthly, cancel any time. Panels are included; medication and any labs ordered by a clinician outside
          the quarterly schedule are billed separately.
        </p>
      </section>

      <section className="section" id="who">
        <div className="section-head">
          <p className="eyebrow">Who {name} is for</p>
          <h2>You&rsquo;ll recognize yourself in one of these.</h2>
        </div>
        <ul className="checklist" style={{ maxWidth: "44rem" }}>
          {audiences.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <div className="cta-band">
          <div>
            <h2>Start with the panel.</h2>
            <p>Everything else follows from knowing the numbers — and from someone reading them with you.</p>
          </div>
          <Link href="/join" className="btn btn-primary btn-lg">Join {name}</Link>
        </div>
        <p className="fine-print" style={{ marginTop: "1rem" }}>
          {name} does not provide emergency care. If you&rsquo;re having chest pain, shortness of breath, or symptoms
          of a stroke, call 911.
        </p>
      </section>
    </>
  );
}
