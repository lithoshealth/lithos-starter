import type { ReviewCard as Review } from "@/lib/setup/steps";

/** Placeholder line widths, fixed so the chart looks the same on every render. */
const LINES = {
  intake: [92, 70, 80, 64, 88, 58],
  history: [96, 84, 72],
  medications: [78, 66, 90, 52],
  labs: [60, 74, 68, 82],
  protocol: [94, 76, 86, 62],
};

function Lines({ widths, columns }: { widths: number[]; columns?: boolean }) {
  return (
    <div className={columns ? "chart-lines chart-lines-cols" : "chart-lines"} aria-hidden="true">
      {widths.map((w, i) => <span key={i} style={{ width: `${w}%` }} />)}
    </div>
  );
}

/**
 * Step 4's clinician review, drawn as the chart a clinician works through
 * rather than a summary of it. The clinical call is Lithos's work and weighs
 * far more than a partner's intake, so the chart shows its shape — sections,
 * not values — and the only numbers on it are true ones: how many answers
 * your intake sent, and how many screening questions came back "yes".
 * Illustrative: Lithos's real clinician tool is its own, in its portal.
 */
export function ReviewCard({ review }: { review: Review }) {
  const who = [review.patient.age !== undefined ? `${review.patient.age}` : null, review.patient.sex, review.patient.state].filter(Boolean).join(" · ");
  const flagged = review.flags.length;
  return (
    <section className="review-card" aria-label="The chart the clinician reviews">
      <header className="review-card-head">
        <div>
          <p className="eyebrow">Clinician review · {review.program}</p>
          <h3>{review.patient.name}</h3>
          {who && <p className="muted">{who}</p>}
        </div>
        <span className="badge badge-outline">Illustrative</span>
      </header>

      <div className="chart-tabs" aria-hidden="true">
        {["Summary", "Intake", "History", "Medications", "Labs", "Screening", "Protocol", "Notes"].map((tab, i) => (
          <span key={tab} className={i === 0 ? "chart-tab chart-tab-on" : "chart-tab"}>{tab}</span>
        ))}
      </div>

      <div className="chart-section">
        <h4><span>Intake answers</span><span>{review.intakeAnswers} from your intake</span></h4>
        <Lines widths={LINES.intake} columns />
      </div>
      <div className="chart-section">
        <h4><span>Screening</span><span>{flagged > 0 ? `${flagged} answered yes` : "all answered no"}</span></h4>
        <Lines widths={LINES.history.slice(0, 2)} />
      </div>
      <div className="chart-section">
        <h4><span>Medical history</span></h4>
        <Lines widths={LINES.history} />
      </div>
      <div className="chart-section">
        <h4><span>Current and past medications</span></h4>
        <Lines widths={LINES.medications} columns />
      </div>
      <div className="chart-section">
        <h4><span>Labs</span></h4>
        <Lines widths={LINES.labs} columns />
      </div>
      <div className="chart-section">
        <h4><span>Protocol criteria</span><span>{review.program}</span></h4>
        <Lines widths={LINES.protocol} />
      </div>
      <p className="chart-more">+ licensure, visit type, dosing, prior clinician notes…</p>

      {review.thread && (
        <div className="review-thread">
          <p><strong>The clinician asked:</strong> {review.thread.question}</p>
          {review.thread.reply && review.thread.awaiting !== "patient"
            ? <p><strong>Your patient replied:</strong> {review.thread.reply}</p>
            : <p className="muted">Waiting for your patient&rsquo;s reply.</p>}
        </div>
      )}

      {review.outcome && (
        <p className={`review-outcome review-outcome-${review.outcome.kind}`}>
          <strong>{{ approved: "Approved.", declined: "Declined." }[review.outcome.kind]}</strong> {review.outcome.detail}
        </p>
      )}

      <p className="fine-print">
        Your intake is one part of what a clinician weighs. In production a licensed Lithos clinician works through the
        chart in Lithos&rsquo;s portal, against the program&rsquo;s protocol.
      </p>
    </section>
  );
}
