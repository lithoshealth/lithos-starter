import Link from "next/link";

/**
 * The membership pages are the only ones that need Eucardia's own database —
 * the clinical journey talks to Lithos and works without it. Rather than a 500
 * on a deployment with no `DATABASE_URL`, say what's missing, in the voice of
 * the page the visitor is standing on.
 */
export function MembershipUnavailable() {
  return (
    <section className="form-card stack">
      <p className="eyebrow">Membership</p>
      <h1>Signups aren&rsquo;t available on this deployment.</h1>
      <p className="lede">
        Eucardia&rsquo;s member database isn&rsquo;t connected here, so joining, member dashboards and member-initiated
        care reviews are switched off. The marketing site and the clinical journey against the Lithos sandbox both work.
      </p>
      <p className="demo-note">
        <strong>For whoever is running this demo:</strong> set <code>DATABASE_URL</code> on the deployment, or run it
        locally with <code>./scripts/db-up.sh</code> and <code>npm run dev</code>.
      </p>
      <p>
        <Link href="/" className="btn btn-ghost">Back to Eucardia</Link>{" "}
        <Link href="/start" className="btn btn-primary">Start a care review instead</Link>
      </p>
    </section>
  );
}
