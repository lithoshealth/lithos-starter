import Link from "next/link";

/**
 * Member pages (welcome, dashboard, a member's care review) read from the
 * partner's own database. Without one there's no member to show. Says exactly
 * that — and makes no claim about the Lithos side, which is a separate question
 * the setup walkthrough answers.
 */
export function MembershipUnavailable() {
  return (
    <section className="form-card stack">
      <p className="eyebrow">Membership</p>
      <h1>There&rsquo;s no member database connected.</h1>
      <p className="lede">
        Member pages read from your own records — the members who exist in your database before Lithos ever sees them.
        This copy of the app doesn&rsquo;t have one, so there&rsquo;s no member to show.
      </p>
      <p className="demo-note">
        Locally, <code>npm run dev</code> runs its own database — restart it if this copy predates that. Where it&rsquo;s
        deployed, set <code>DATABASE_URL</code> to a hosted Postgres.
        Connecting to Lithos is a separate step, and needs no database: the setup walkthrough covers it.
      </p>
      <p>
        <Link href="/" className="btn btn-ghost">Back to the app</Link>{" "}
        <Link href="/setup" className="btn btn-primary">Open the Developer pages</Link>
      </p>
    </section>
  );
}
