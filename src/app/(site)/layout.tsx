import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/app-meta";
import { lithosConnection } from "@/lib/lithos/connection";

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.6 5 6.1 5c2 0 3.3 1.1 4 2.2.7-1.1 2-2.2 4-2.2 3.5 0 5.2 3.6 3.7 6.9C19.5 16.4 12 21 12 21z" fill="currentColor" />
    </svg>
  );
}

export default function SiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {/*
        Development only. `npm run dev` prints http://localhost:3001, and that's
        the link people click — which lands here, on a patient-facing page, with
        nothing saying the walkthrough exists. Never rendered in a production build.
      */}
      {process.env.NODE_ENV === "development" && (
        <div className="dev-bar" role="note">
          {lithosConnection().connected
            ? <>Connected to the Lithos sandbox — forms on this site create real sandbox patients and encounters. <Link href="/setup">Setup →</Link></>
            : <>Setting up your Lithos sandbox? <Link href="/setup">Open the setup walkthrough →</Link></>}
        </div>
      )}
      <div className="demo-bar" role="note">Demo environment · sample patients only · no real medical care is provided here</div>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand"><BrandMark />{APP_NAME}</Link>
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
          <p className="footer-note">© {new Date().getFullYear()} {APP_NAME}. Care is delivered by licensed clinicians. This is a demo build running against a sandbox — use sample patient details only.</p>
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
