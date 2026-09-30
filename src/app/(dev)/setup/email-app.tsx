/**
 * "Keep it": download the app, or open a Gmail draft to whoever signed up in
 * step 1 — after a demo, the prospect — saying how to run it. A link can't
 * attach a file, and Gmail blocks zips with code in them anyway, so the zip goes
 * in through the draft's Drive button, as a shared link. The email goes from
 * your own address, so replies come to you. Gmail because Lithos runs on Google
 * Workspace; the draft is plain text, so any other mail app takes it pasted.
 */
export function KeepItButtons({ to, brandName, folder, docsUrl }: { to?: string; brandName: string; folder: string; docsUrl: string }) {
  const subject = `Your ${brandName} app, built on Lithos`;
  const body = [
    "Hi,",
    "",
    `Here's the ${brandName} app we put together on our call: your brand, program and patient intake, running on Lithos's sandbox. It's ${folder}.zip, linked below.`,
    "",
    "To run it (your developer will need Node 20 or later):",
    `1. Unzip it and open a terminal in the ${folder} folder.`,
    "2. Run: npm install && npm run dev",
    '3. Open http://localhost:3001/setup and click "Get sandbox credentials" in step 1. That creates your own Lithos sandbox organization.',
    "",
    "Working with a coding agent like Claude Code or Cursor? Unzip it, open the agent in that folder and ask it to get the app running. AGENTS.md in the folder tells it how.",
    "",
    `START-HERE.md in the folder walks through the rest, and the API reference is at ${docsUrl}.`,
    "",
  ].join("\n");
  const draft = `https://mail.google.com/mail/?${new URLSearchParams({ view: "cm", fs: "1", to: to ?? "", su: subject, body })}`;

  return (
    <p className="setup-next-actions">
      <a className="btn btn-ghost" href="/setup/download" download>Download app</a>
      <a className="btn btn-ghost" href={draft} target="_blank" rel="noopener">Email app</a>
    </p>
  );
}
