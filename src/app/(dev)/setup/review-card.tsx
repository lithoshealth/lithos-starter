import type { ReviewCard as Review } from "@/lib/setup/steps";

/**
 * Step 4's illustrative clinician review: the case a clinician decides, laid
 * out the way they'd take it in. Built only from what your intake sent and
 * the API returns — Lithos's real clinician tool is its own, in its portal.
 */
export function ReviewCard({ review }: { review: Review }) {
  const who = [review.patient.age !== undefined ? `${review.patient.age}` : null, review.patient.sex, review.patient.state].filter(Boolean).join(" · ");
  return (
    <section className="review-card" aria-label="What the clinician reviews">
      <header className="review-card-head">
        <div>
          <p className="eyebrow">Clinician review · {review.program}</p>
          <h3>{review.patient.name}</h3>
          {who && <p className="muted">{who}</p>}
        </div>
        <span className="badge badge-outline">Illustrative</span>
      </header>

      <dl className="review-facts">
        {review.facts.map((fact) => (
          <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
        ))}
        <div><dt>Requested</dt><dd>{review.requested.join(", ") || "—"}</dd></div>
      </dl>

      <div className={review.flags.length > 0 ? "review-flags review-flags-yes" : "review-flags"}>
        <strong>{review.flags.length > 0 ? "Answered yes to" : "Screening questions"}</strong>
        {review.flags.length > 0
          ? <ul>{review.flags.map((flag) => <li key={flag}>{flag}</li>)}</ul>
          : <p>No to every one.</p>}
      </div>

      {review.outcome && (
        <p className={`review-outcome review-outcome-${review.outcome.kind}`}>
          <strong>{{ approved: "Approved.", declined: "Declined.", asked: "Question sent." }[review.outcome.kind]}</strong> {review.outcome.detail}
        </p>
      )}

      <p className="fine-print">
        What a clinician works from, from your intake. In production a licensed clinician reviews it in Lithos&rsquo;s
        portal against the program&rsquo;s protocol; the sandbox lets you make the call.
      </p>
    </section>
  );
}
