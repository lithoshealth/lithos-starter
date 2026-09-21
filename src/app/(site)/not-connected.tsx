import Link from "next/link";

/**
 * What a visitor sees when they reach something that needs Lithos before the app
 * is connected to it. Deliberately an explanation, not an error: the form they
 * just submitted is fine — what's missing is the part that turns it into care.
 * No hooks and no server imports, so client forms can render it too.
 */
export function NotConnected({ action, outcome }: { action: string; outcome: string }) {
  return (
    <section className="not-connected stack" aria-live="polite">
      <p className="eyebrow">Not connected yet</p>
      <h2>This site isn&rsquo;t connected to Lithos.</h2>
      <p>
        {action} — and that&rsquo;s the part Lithos does: {outcome}. Right now there&rsquo;s nowhere to send it, so nothing
        was sent.
      </p>
      <p>
        That gap is the whole job: connecting this site to actual care. It takes about fifteen minutes — add your
        sandbox credentials, and the walkthrough checks each step against the live API.
      </p>
      <p>
        <Link href="/setup" className="btn btn-primary">Connect it to Lithos →</Link>
      </p>
    </section>
  );
}
