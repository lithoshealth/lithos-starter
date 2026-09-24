import { isLight } from "@/lib/starter-config";

/**
 * What the partner's app would send its patient when the clinician asks a
 * question: an email in the partner's own brand, pointing back to where the
 * patient answers. Shown, not sent — Lithos never contacts the patient, and
 * sending is the partner's own email or text provider.
 */
export function PatientNotification({ brand, patientFirstName, question }: { brand: { name: string; color: string }; patientFirstName: string; question: string }) {
  return (
    <figure className="patient-notification">
      <figcaption className="muted">The message your app sends your patient — by email or text, through your own provider:</figcaption>
      <div className="notification-card">
        <p className="notification-meta"><strong>From:</strong> {brand.name} · <strong>Subject:</strong> Your clinician has a question</p>
        <p>Hi {patientFirstName},</p>
        <p>The clinician reviewing your request needs one more thing before deciding:</p>
        <blockquote>{question}</blockquote>
        <p>
          <span className="notification-button" style={{ background: brand.color, color: isLight(brand.color) ? "#1a1a1a" : "#fff" }}>Answer your clinician</span>
        </p>
        <p className="muted">Your review is paused until you reply.</p>
      </div>
    </figure>
  );
}
