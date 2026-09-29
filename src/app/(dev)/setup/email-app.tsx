"use client";

import { useState } from "react";

/**
 * "Email it": downloads the app and opens a Gmail draft to whoever signed up in
 * step 1 — after a demo, the prospect. A link can't attach a file, so the draft
 * asks for the zip that just landed in Downloads; the email goes from your own
 * address, so replies come to you. Gmail because Lithos runs on Google
 * Workspace; the draft is plain text, so any other mail app takes it pasted.
 */
export function EmailAppButton({ to, brandName, folder, docsUrl }: { to?: string; brandName: string; folder: string; docsUrl: string }) {
  const [sent, setSent] = useState(false);
  const subject = `Your ${brandName} app, built on Lithos`;
  const body = [
    "Hi,",
    "",
    `Here's the ${brandName} app we put together on our call: your brand, program and patient intake, running on Lithos's sandbox. It's attached as ${folder}.zip.`,
    "",
    "To run it (your developer will need Node 20 or later):",
    `1. Unzip it and open a terminal in the ${folder} folder.`,
    "2. Run: npm install && npm run dev",
    '3. Open http://localhost:3001/setup and click "Get sandbox credentials" in step 1. That creates your own Lithos sandbox organization.',
    "",
    `START-HERE.md in the folder walks through the rest, and the API reference is at ${docsUrl}.`,
    "",
  ].join("\n");
  const draft = `https://mail.google.com/mail/?${new URLSearchParams({ view: "cm", fs: "1", to: to ?? "", su: subject, body })}`;

  return (
    <>
      <p>
        {/* The link downloads; the click also opens the draft beside it. */}
        <a className="btn btn-ghost" href="/setup/download" download onClick={() => { window.open(draft, "_blank", "noopener"); setSent(true); }}>
          Email your app
        </a>
      </p>
      <p className="fine-print" aria-live="polite">
        {sent
          ? <>Your draft opened in a new tab. Drag <strong>{folder}.zip</strong> from Downloads into it, then send.</>
          : <>{to ? <>To {to}. </> : null}Or just <a href="/setup/download" download>download it</a>.</>}
      </p>
    </>
  );
}
