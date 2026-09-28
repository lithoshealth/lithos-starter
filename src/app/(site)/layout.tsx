import Link from "next/link";
import type { ReactNode } from "react";
import { getBrand } from "@/lib/app-meta";
import { lithosConnection } from "@/lib/lithos/connection";
import { describeFailure, webhookHealth } from "@/lib/webhooks/health";
import { EmbedMarker } from "./embed-marker";

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.6 5 6.1 5c2 0 3.3 1.1 4 2.2.7-1.1 2-2.2 4-2.2 3.5 0 5.2 3.6 3.7 6.9C19.5 16.4 12 21 12 21z" fill="currentColor" />
    </svg>
  );
}

export default async function SiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  const dev = process.env.NODE_ENV === "development";
  const brand = await getBrand();
  const connected = lithosConnection().connected;
  // After setup is when webhooks break (a restarted tunnel), so keep watching.
  const health = dev && connected ? await webhookHealth() : null;

  return (
    <>
      {/*
        Development only. `npm run dev` prints http://localhost:3001, and that's
        the link people click — which lands here, on a patient-facing page, with
        nothing saying the walkthrough exists. Never rendered in a production build.
      */}
      {dev && health?.state === "failing" && (
        <div className="dev-bar dev-bar-warning" role="alert">
          Webhooks failing. {describeFailure(health)} <Link href="/setup">Fix it in setup →</Link>
        </div>
      )}
      {dev && health?.state !== "failing" && (
        <div className="dev-bar" role="note">
          {connected
            ? <>Connected to the Lithos sandbox — forms on this site create real sandbox patients and encounters. <Link href="/setup">Setup →</Link></>
            : <>Setting up your Lithos sandbox? <Link href="/setup">Open the setup walkthrough →</Link></>}
        </div>
      )}
      <EmbedMarker />
      <div className="demo-bar" role="note">Demo environment · sample patients only · no real medical care is provided here</div>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- a user-uploaded logo of unknown size; next/image needs dimensions up front */}
            {brand.logo ? <img src={brand.logo} alt="" className={brand.logoWide ? "brand-logo brand-logo-wide" : "brand-logo"} /> : <BrandMark />}
            {/* A wordmark already says the name: keep it for screen readers only. */}
            <span className={brand.logo && brand.logoWide ? "visually-hidden" : undefined}>{brand.name}</span>
            {/* The company's line, small beside the name — the page headline belongs to the program. */}
            {brand.tagline && <span className="brand-tagline">{brand.tagline}</span>}
          </Link>
          <nav className="site-nav" aria-label="Primary navigation">
            <Link href="/#program">The program</Link>
            <Link href="/#numbers">What we measure</Link>
            <Link href="/start">Care review</Link>
            <Link href="/#plans" className="btn btn-primary">See plans</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div className="footer-inner">
          <p className="footer-note"><strong>{brand.name}</strong> — {brand.tagline} © {new Date().getFullYear()}. Care is delivered by licensed clinicians. This is a demo build running against a sandbox — use sample patient details only.</p>
          <nav className="footer-ops" aria-label="Operations">
            <span>Ops:</span>
            <Link href="/setup">Setup</Link>
            <Link href="/members">Members</Link>
            <Link href="/journeys">Journeys</Link>
            <Link href="/events">Webhook events</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
