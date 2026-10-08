import type { Metadata } from "next";
import Link from "next/link";
import { getBrand } from "@/lib/app-meta";
import { getLithosClient } from "@/lib/lithos/client";
import { journey } from "@/lib/portal/journey";
import { listSignInChoices } from "@/lib/portal/load";
import { demoSignInEnabled } from "@/lib/portal/session";
import {
  awaitingPatient, carePath, clinicianFullName, delivery, greeting, headline, medications, newestPlan, nextStep, orderFor, progress,
  upcomingVisit, type Clinician, type Medication, type NextStep, type PortalData, type Progress,
} from "@/lib/portal/view";
import { readClock } from "@/lib/sandbox-clock";
import { isSandboxBaseUrl } from "@/lib/sandbox-review";
import { programFor } from "@/lib/setup/programs";
import { signInAction } from "./actions";
import { Icon } from "./icons";
import { portalPageState } from "./page-state";
import { RxActions } from "./rx-details";
import { PortalShell, initials } from "./shell";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

/**
 * Home: what someone who signed up sees when they come back. Read live from
 * Lithos on every visit — the clinical record lives there, so there's nothing
 * to store here but who's signed in.
 */
export default async function PortalHome() {
  const state = await portalPageState();
  if (state.kind === "screen") return state.screen;
  if (state.kind === "signed_out") return <SignIn />;
  return <Home data={state.data} />;
}

// ------------------------------------------------------------------ sign-in

async function SignIn() {
  if (!demoSignInEnabled()) return <YourLogin />;
  const [brand, people] = await Promise.all([getBrand(), listSignInChoices(getLithosClient())]);
  const joined = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <PortalShell eyebrow="Welcome back" title={`Sign in to ${brand.name}`} lede="Pick someone from your records to see the app as they would.">
      {people.length ? (
        <ul className="portal-patients">
          {people.map((p) => (
            <li key={p.id}>
              <form action={signInAction}>
                <input type="hidden" name={p.kind === "member" ? "member_id" : "patient_id"} value={p.id} />
                <button className="portal-patient">
                  <span className="portal-avatar" aria-hidden="true">{initials(p.firstName, p.lastName)}</span>
                  <span><strong>{p.firstName} {p.lastName}</strong><span className="muted">{p.note} · since {joined(p.since)}</span></span>
                  <Icon name="chevron" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card-soft">
          <p><strong>No one here yet.</strong></p>
          <p className="muted">Create one in step 2 of the <Link href="/setup">setup walkthrough</Link>, or through <Link href="/start">the care review</Link>.</p>
        </div>
      )}
    </PortalShell>
  );
}

/**
 * Connected outside the sandbox there's no list of patients to pick from:
 * the data may be real. A partner's app signs patients in with its own login.
 */
async function YourLogin() {
  const brand = await getBrand();
  return (
    <PortalShell eyebrow="Your account" title={`Sign in to ${brand.name}`} lede="Patients sign in here with your own login.">
      <div className="card-soft">
        <p><strong>The demo sign-in is off.</strong></p>
        <p className="muted">
          This app is connected to Lithos outside the sandbox, where patients are real, so it won&rsquo;t list them or let
          anyone pick one. Connect your own login in <code>src/lib/portal/session.ts</code>: read the signed-in user and
          return their Lithos patient ID. Everything else on these pages works as it is.
        </p>
      </div>
    </PortalShell>
  );
}

// ------------------------------------------------------------------ home

function formatters(zone: string) {
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const day = (iso: string) =>
    new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { timeZone: zone, month: "short", day: "numeric", year: "numeric" });
  const short = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { timeZone: zone, month: "short", day: "numeric" });
  return { when, day, short };
}

/** The organization's "now": a sandbox test clock when one is set, so the plan agrees with Lithos's dates. */
async function orgNow(): Promise<Date> {
  if (!isSandboxBaseUrl(process.env.LITHOS_API_BASE_URL)) return new Date();
  const clock = await readClock(getLithosClient()).catch(() => null);
  return clock ? new Date(clock.frozen_time) : new Date();
}

async function Home({ data }: { data: PortalData }) {
  const zone = data.patient.time_zone ?? "UTC";
  const { when, day, short } = formatters(zone);
  const now = await orgNow();
  const plan = newestPlan(data);
  const program = programFor(plan?.category);
  const step = nextStep(data, when);
  const meds = medications(data);
  const trend = progress(data, plan?.category);
  const firstOrder = orderFor(data, meds[0]?.orderId ?? null);
  const deliveredAt = firstOrder?.status === "completed" ? firstOrder.completed_at ?? firstOrder.updated_at : null;
  const steps = journey(plan?.category, plan?.status === "active" ? plan.active_at : null, meds[0]?.refillDueAt ?? null, deliveredAt, now);
  const visit = step.kind === "visit" ? undefined : upcomingVisit(data);
  const nextInPlan = steps.find((s) => s.state === "next");
  const question = awaitingPatient(data)[0];
  const clinician = (plan?.clinician ?? data.patient.assigned_clinician) as Clinician;

  return (
    <PortalShell tab="home" data={data} eyebrow={greeting(now, zone)} title={`Hi ${data.patient.first_name}`} lede={headline(data, step, day)}>
      {question && (
        <Link href="/portal/messages" className="app-alert">
          <span className="app-alert-dot" aria-hidden="true" />
          <span><strong>{step.kind === "question" ? step.title : "Your care team wrote to you"}</strong><span>Tap to reply</span></span>
          <Icon name="chevron" />
        </Link>
      )}

      {meds.length
        ? meds.map((m) => <RxCard key={`${m.name}-${m.strength}`} med={m} data={data} program={program?.label} day={day} short={short} />)
        : <RequestCard step={step} data={data} program={program?.label} />}

      {(visit || nextInPlan) && (
        <Link href={visit ? `/care/${encodeURIComponent(visit.encounterId)}` : "#plan"} className="card-row">
          <span className="card-row-icon"><Icon name="calendar" /></span>
          <span className="card-row-text">
            <span className="card-label">Upcoming</span>
            <strong>{visit ? `Video visit · ${when(visit.appointment.starts_at)}` : nextInPlan!.date ? `${nextInPlan!.title} · ${short(nextInPlan!.date)}` : nextInPlan!.title}</strong>
            <span className="muted">{visit ? `With ${clinicianFullName(visit.appointment.clinician)}` : nextInPlan!.detail}</span>
          </span>
          <Icon name="chevron" />
        </Link>
      )}

      {clinician && (
        <div className="card-row">
          {clinician.profile_picture_url
            // eslint-disable-next-line @next/next/no-img-element -- a clinician's photo from Lithos, any size
            ? <img src={clinician.profile_picture_url} alt="" className="card-row-photo" />
            : <span className="card-row-icon">{initials(String(clinician.first_name ?? ""), String(clinician.last_name ?? ""))}</span>}
          <span className="card-row-text">
            <span className="card-label">Your clinician</span>
            <strong>{clinicianFullName(clinician)}</strong>
            <span className="muted">Reviews your care and answers your messages</span>
          </span>
          <Link href="/portal/messages" className="btn btn-ghost card-row-btn">Message</Link>
        </div>
      )}

      {(trend || steps.length > 0) && (
        <section className="card-soft plan" id="plan" aria-label="Your plan">
          <h2 className="card-heading">Your plan</h2>
          {trend && <ProgressLine trend={trend} short={short} />}
          {steps.length > 0 && (
            <ol className="plan-steps">
              {steps.map((s) => (
                <li key={`${s.title}-${s.date}`} className={`plan-step plan-step-${s.state}`}>
                  <span className="plan-dot" aria-hidden="true">{s.state === "done" && <Icon name="check" size={12} />}</span>
                  <span><strong>{s.title}</strong><span className="muted">{s.date ? `${short(s.date)} · ` : ""}{s.detail}</span></span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </PortalShell>
  );
}

function RxCard({ med, data, program, day, short }: { med: Medication; data: PortalData; program?: string; day: (iso: string) => string; short: (iso: string) => string }) {
  const order = orderFor(data, med.orderId);
  const shipment = order ? delivery(order) : undefined;
  const rows: Array<[string, string]> = [
    ["Prescribed by", `${med.prescriber} · ${day(med.writtenAt)}`],
    ...(shipment?.pharmacy ? [["Pharmacy", shipment.pharmacy] as [string, string]] : []),
    ...(order?.shipping_address ? [["Ships to", `${order.shipping_address.line1 ?? ""}, ${order.shipping_address.city}, ${order.shipping_address.state}`] as [string, string]] : []),
    ...(shipment?.tracking ? [["Tracking", shipment.tracking] as [string, string]] : []),
  ];
  return (
    <article className="rx">
      <div className="rx-top">
        {program && <span className="rx-chip">{program}</span>}
        <span className="rx-status"><Icon name="check" size={14} /> Active</span>
      </div>
      <h2 className="rx-name">{med.name}</h2>
      <p className="rx-sub">{med.strength} · {med.amount}</p>

      {shipment && (
        <div className="rx-delivery">
          <span className="rx-delivery-icon"><Icon name="box" /></span>
          <span>
            <strong>{shipment.label} · {short(shipment.at)}{shipment.to ? ` · ${shipment.to}` : ""}</strong>
            <span className="muted">{shipment.pharmacy ? `via ${shipment.pharmacy}` : "The pharmacy is confirming your order"}</span>
          </span>
          <span className="rx-stages" aria-label={`Step ${shipment.stage} of 4`}>
            {[1, 2, 3, 4].map((n) => <span key={n} className={n <= shipment.stage ? "on" : undefined} />)}
          </span>
        </div>
      )}

      <div className="rx-facts">
        <div><span className="card-label">Supply</span><strong>{med.daysSupply} days</strong></div>
        <div><span className="card-label">Next refill</span><strong>{med.refillEligible ? "Ready now" : med.refillDueAt ? day(med.refillDueAt) : "Not yet due"}</strong></div>
      </div>
      <div className="rx-how">
        <span className="card-label">How to take</span>
        <p>{med.instructions}</p>
      </div>
      <RxActions
        primary={med.refillEligible
          ? { href: `/portal/messages?draft=${encodeURIComponent(`I'd like to request a refill of ${med.name}.`)}`, label: "Request refill" }
          : { href: "/portal/messages", label: "Ask a question" }}
        rows={rows}
      />
    </article>
  );
}

const REQUEST_STATUS: Record<NextStep["kind"], string> = {
  question: "Needs your answer", book_visit: "Visit needed", visit: "Visit booked", in_review: "In review",
  shipping: "Approved", not_a_fit: "Not approved", all_set: "Up to date",
};

/** Before there's a prescription: the request itself, and where it stands. */
function RequestCard({ step, data, program }: { step: NextStep; data: PortalData; program?: string }) {
  const path = carePath(data);
  return (
    <article className="rx">
      <div className="rx-top">
        {program && <span className="rx-chip">{program}</span>}
        <span className={`rx-status${step.kind === "not_a_fit" ? " rx-status-off" : step.kind === "in_review" ? " rx-status-wait" : ""}`}>{REQUEST_STATUS[step.kind]}</span>
      </div>
      <h2 className="rx-name">{step.kind === "not_a_fit" ? "A note from your clinician" : "Your care review"}</h2>
      <p className="rx-sub">{step.kind === "question" ? "Your clinician needs one answer from you before they decide." : step.detail}</p>
      {step.kind !== "not_a_fit" && (
        <ol className="rx-path">
          {path.map((s) => <li key={s.label} className={`rx-path-${s.state}`}><span aria-hidden="true" />{s.label}</li>)}
        </ol>
      )}
      {step.kind === "question" && <div className="rx-actions"><Link href="/portal/messages" className="btn rx-btn-primary">Answer your clinician</Link></div>}
      {step.kind === "book_visit" && <div className="rx-actions"><Link href={`/care/${encodeURIComponent(step.encounterId)}`} className="btn rx-btn-primary">Choose a time</Link></div>}
      {step.kind === "visit" && <div className="rx-actions"><Link href={`/care/${encodeURIComponent(step.encounterId)}`} className="btn rx-btn-primary">Go to your visit</Link></div>}
    </article>
  );
}

function ProgressLine({ trend, short }: { trend: Progress; short: (iso: string) => string }) {
  const first = trend.readings[0];
  const last = trend.readings.at(-1)!;
  const change = last.value - first.value;
  return (
    <div className="plan-progress">
      <span className="card-label">Your {trend.label}</span>
      <p className="plan-number">
        {last.value} <span>{trend.unit}</span>
        {trend.readings.length > 1 && change !== 0 && (
          <em className={change < 0 ? "down" : "up"}>{change < 0 ? "↓" : "↑"} {Math.abs(change)} since {short(first.date)}</em>
        )}
      </p>
      {trend.readings.length > 1
        ? <Sparkline values={trend.readings.map((r) => r.value)} label={`${trend.label} from ${first.value} to ${last.value} ${trend.unit}`} />
        : <p className="muted">Your starting point, from {short(first.date)}. Each check-in adds a point.</p>}
    </div>
  );
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 300, h = 56, pad = 6;
  const min = Math.min(...values), max = Math.max(...values);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (values.length - 1);
  const y = (v: number) => (max === min ? h / 2 : pad + ((max - v) * (h - 2 * pad)) / (max - min));
  return (
    <svg className="plan-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" />)}
    </svg>
  );
}
