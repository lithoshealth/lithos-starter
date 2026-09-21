import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import { APP_NAME } from "@/lib/app-meta";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — Cardiometabolic membership`, template: `%s · ${APP_NAME}` },
  description: "A membership for managing cholesterol and cardiovascular risk: a panel every quarter, a coach who reads it with you, and medical care added when lifestyle alone isn't enough.",
  robots: { index: false, follow: false },
};

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.6 5 6.1 5c2 0 3.3 1.1 4 2.2.7-1.1 2-2.2 4-2.2 3.5 0 5.2 3.6 3.7 6.9C19.5 16.4 12 21 12 21z" fill="currentColor" />
    </svg>
  );
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>
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
              <Link href="/members">Members</Link>
              <Link href="/journeys">Journeys</Link>
              <Link href="/events">Webhook events</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
