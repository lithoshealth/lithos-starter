import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import { brandCss, getBrand } from "@/lib/app-meta";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getBrand();
  return {
    title: { default: `${name} — Cardiometabolic membership`, template: `%s · ${name}` },
    description: "A membership for managing cholesterol and cardiovascular risk: a panel every quarter, a coach who reads it with you, and medical care added when lifestyle alone isn't enough.",
    robots: { index: false, follow: false },
  };
}

// Only the document shell. The patient-facing site and the developer
// walkthrough each bring their own chrome — see (site)/layout.tsx and
// (dev)/layout.tsx — so a developer on /setup isn't looking at a health brand.
export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const brand = await getBrand();
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      {/* The brand colour from starter.config.json, over the stylesheet's defaults. */}
      <head><style>{brandCss(brand)}</style></head>
      <body>{children}</body>
    </html>
  );
}
