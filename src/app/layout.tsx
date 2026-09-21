import type { Metadata } from "next";
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

// Only the document shell. The patient-facing site and the developer
// walkthrough each bring their own chrome — see (site)/layout.tsx and
// (dev)/layout.tsx — so a developer on /setup isn't looking at a health brand.
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
