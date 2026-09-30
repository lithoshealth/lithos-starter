import type { Metadata } from "next";
import Link from "next/link";
import { getBrand } from "@/lib/app-meta";
import { getLithosClient } from "@/lib/lithos/client";
import { lithosConnection } from "@/lib/lithos/connection";
import { LithosApiError } from "@/lib/lithos/errors";
import { listPatients, loadPortal } from "@/lib/portal/load";
import { readPortalPatientId } from "@/lib/portal/session";
import {
  carePath, conversations, delivery, medications, nextStep, orderFor, progress, upcomingVisit,
  type NextStep, type PortalData, type Progress,
} from "@/lib/portal/view";
import { programFor } from "@/lib/setup/programs";
import { NotConnected } from "../not-connected";
import { signInAction, signOutAction } from "./actions";
import { ReplyForm } from "./reply-form";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

/**
 * The patient's side of the app: what someone who signed up sees when they come
 * back. Read live from Lithos on every visit — the clinical record lives there,
 * so there's nothing to store here but who's signed in.
 */
export default async function PortalPage() {
  if (!lithosConnection().connected) {
    return (
      <section className="portal">
        <NotConnected action="This page shows a patient their care" outcome="it holds their record — the review, the prescription, the delivery" />
      </section>
    );
  }

  const client = getLithosClient();
  const patientId = await readPortalPatientId();
  let loaded: { patients: Awaited<ReturnType<typeof listPatients>> } | { data: PortalData } | { error: LithosApiError };
  try {
    loaded = patientId ? { data: await loadPortal(client, patientId) } : { patients: await listPatients(client) };
  } catch (error) {
    if (!(error instanceof LithosApiError)) throw error;
    loaded = { error };
  }

  if ("patients" in loaded) return <SignIn patients={loaded.patients} />;
  if ("data" in loaded) return <Home data={loaded.data} />;
  const { error } = loaded;
  return (
    <section className="portal">
      <div className="error-box">
        <h2>We couldn&rsquo;t load your account</h2>
        <p className="muted">Lithos responded with HTTP {error.status}.</p>
        <ul>{error.errors.map((e, i) => <li key={`${e.code}-${i}`}>{e.message}{e.source?.pointer && <code className="muted"> {e.source.pointer}</code>}</li>)}</ul>
      </div>
      <form action={signOutAction}><button className="btn btn-ghost">Choose another patient</button></form>
    </section>
  );
}

function DemoNote({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="portal-demo" role="note">
      <span>Demo sign-in. In your app, patients sign in with your own login — Lithos has no patient accounts.</span>
      {signedIn && <form action={signOutAction}><button className="link-button">Switch patient</button></form>}
    </div>
  );
}

// ------------------------------------------------------------------ sign-in

async function SignIn({ patients }: { patients: Awaited<ReturnType<typeof listPatients>> }) {
  const brand = await getBrand();
  const joined = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <section className="portal">
      <DemoNote signedIn={false} />
      <div className="portal-hello">
        <h1>Sign in to {brand.name}</h1>
        <p className="muted">Pick a sample patient to see the app as they would.</p>
      </div>
      {patients.length ? (
        <ul className="portal-patients">
          {patients.map((p) => (
            <li key={p.id}>
              <form action={signInAction}>
                <input type="hidden" name="patient_id" value={p.id} />
                <button className="portal-patient">
                  <span className="portal-avatar" aria-hidden="true">{initials(p.first_name, p.last_name)}</span>
                  <span><strong>{p.first_name} {p.last_name}</strong><span className="muted">Joined {joined(p.created_at)}</span></span>
                  <span aria-hidden="true" className="portal-chevron">›</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <div className="portal-card">
          <p><strong>No patients yet.</strong></p>
          <p className="muted">Onboard one in step 3 of the <Link href="/setup">setup walkthrough</Link>, or through <Link href="/start">the care review</Link>.</p>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ home

async function Home({ data }: { data: PortalData }) {
  const brand = await getBrand();
  const zone = data.patient.time_zone ?? "UTC";
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { timeZone: zone, month: "short", day: "numeric" });

  const plan = [...data.carePlans].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const program = programFor(plan?.category);
  const step = nextStep(data, when);
  const path = carePath(data);
  const meds = medications(data);
  const trend = progress(data, plan?.category);
  const visit = step.kind === "visit" ? undefined : upcomingVisit(data);
  const threads = conversations(data).filter((t) => step.kind !== "question" || t.id !== step.inquiryId);

  return (
    <section className="portal">
      <DemoNote signedIn />
      <div className="portal-hello">
        <span className="portal-avatar portal-avatar-lg" aria-hidden="true">{initials(data.patient.first_name, data.patient.last_name)}</span>
        <div>
          <h1>Hi {data.patient.first_name}</h1>
          <p className="muted">{program ? `Your ${program.label.toLowerCase()} with ${brand.name}` : `Your care with ${brand.name}`}</p>
        </div>
      </div>

      <NextStepCard step={step} />

      {/* Not a fit: there's no path to walk, and the note above says why. */}
      {plan && plan.status !== "ineligible" && (
        <div className="portal-card">
          <p className="portal-label">Your care</p>
          <ol className="portal-path">
            {path.map((s) => <li key={s.label} className={`portal-path-${s.state}`}><span aria-hidden="true" />{s.label}</li>)}
          </ol>
        </div>
      )}

      {meds.map((m) => {
        const order = orderFor(data, m.orderId);
        const status = order ? delivery(order) : undefined;
        return (
          <div className="portal-card" key={`${m.name}-${m.strength}`}>
            <p className="portal-label">Your medication</p>
            <p className="portal-title">{m.name} <span className="portal-strength">{m.strength}</span></p>
            <p className="muted">{m.instructions}</p>
            <p className="portal-meta">
              {m.daysSupply}-day supply · prescribed by {m.prescriber}
              {m.refillDueAt && <> · refill {day(m.refillDueAt)}</>}
            </p>
            {status && <p className={`portal-delivery${status.done ? " portal-delivery-done" : ""}`}><span aria-hidden="true">●</span> {status.label}</p>}
          </div>
        );
      })}

      {trend && <ProgressCard trend={trend} day={day} />}

      {visit && (
        <div className="portal-card portal-row">
          <div>
            <p className="portal-label">Next visit</p>
            <p className="portal-title">Video · {when(visit.appointment.starts_at)}</p>
          </div>
          <Link className="btn btn-ghost" href={`/care/${encodeURIComponent(visit.encounterId)}`}>Details</Link>
        </div>
      )}

      {threads.length > 0 && (
        <div className="portal-card">
          <p className="portal-label">Messages</p>
          <ul className="portal-threads">
            {threads.slice(0, 3).map((t) => {
              const last = t.messages?.at(-1);
              return (
                <li key={t.id}>
                  <strong>{t.subject ?? "Your care team"}</strong>
                  <span className="muted">{last ? `${last.sender.type === "patient" ? "You: " : ""}${last.body}` : t.status === "open" ? "Waiting on your care team" : "Resolved"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="portal-footnote">Everything on this page is read live from Lithos for this patient.</p>
    </section>
  );
}

function NextStepCard({ step }: { step: NextStep }) {
  return (
    <div className={`portal-next portal-next-${step.kind}`}>
      <p className="portal-label">{step.kind === "all_set" || step.kind === "in_review" || step.kind === "shipping" ? "Right now" : "Next step"}</p>
      <p className="portal-next-title">{step.title}</p>
      <p className="portal-next-detail">{step.kind === "question" ? `“${step.detail}”` : step.detail}</p>
      {step.kind === "question" && <ReplyForm inquiryId={step.inquiryId} />}
      {step.kind === "book_visit" && <Link className="btn portal-btn-strong" href={`/care/${encodeURIComponent(step.encounterId)}`}>Choose a time</Link>}
      {step.kind === "visit" && <Link className="btn portal-btn-strong" href={`/care/${encodeURIComponent(step.encounterId)}`}>Go to your visit</Link>}
    </div>
  );
}

function ProgressCard({ trend, day }: { trend: Progress; day: (iso: string) => string }) {
  const first = trend.readings[0];
  const last = trend.readings.at(-1)!;
  const change = last.value - first.value;
  return (
    <div className="portal-card">
      <p className="portal-label">Your {trend.label}</p>
      <p className="portal-title">
        {last.value} <span className="portal-strength">{trend.unit}</span>{" "}
        {trend.readings.length > 1 && change !== 0 && (
          <span className={change < 0 ? "portal-change-down" : "portal-change-up"}>
            {change < 0 ? "down" : "up"} {Math.abs(change)} since {day(first.date)}
          </span>
        )}
      </p>
      {trend.readings.length > 1
        ? <Sparkline values={trend.readings.map((r) => r.value)} label={`${trend.label} from ${first.value} to ${last.value} ${trend.unit}`} />
        : <p className="muted">Your starting point, from {day(first.date)}. Each check-in adds a point here.</p>}
    </div>
  );
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 300, h = 64, pad = 6;
  const min = Math.min(...values), max = Math.max(...values);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (values.length - 1);
  const y = (v: number) => (max === min ? h / 2 : pad + ((max - v) * (h - 2 * pad)) / (max - min));
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg className="portal-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <polyline points={points} fill="none" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" />)}
    </svg>
  );
}

const initials = (first: string, last: string) => `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
