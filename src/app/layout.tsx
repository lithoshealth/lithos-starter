import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import { brandCss, brandFontHref, getBrand, getSite } from "@/lib/app-meta";
import { brandContent } from "@/lib/programs/content";
import { programFor } from "@/lib/setup/programs";
import { ScrollToTop } from "./scroll-to-top";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { brand, content, multi, programs } = await getSite();
  return {
    title: { default: `${brand.name} — ${multi ? "Online care" : content.category}`, template: `%s · ${brand.name}` },
    description: multi ? brandContent(programs.map((key) => programFor(key)?.label ?? key)).description : content.description,
    robots: { index: false, follow: false },
  };
}

// Only the document shell. The patient-facing site and the developer
// walkthrough each bring their own chrome — see (site)/layout.tsx and
// (dev)/layout.tsx — so a developer on /setup isn't looking at a health brand.
export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const brand = await getBrand();
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`} data-scroll-behavior="smooth">
      {/* The brand colour from starter.config.json, over the stylesheet's defaults. */}
      <head>
        {brandFontHref(brand) && (
          <>
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link rel="stylesheet" href={brandFontHref(brand)!} />
          </>
        )}
        <style>{brandCss(brand)}</style>
      </head>
      <body>
        {children}
        <ScrollToTop />
      </body>
    </html>
  );
}
