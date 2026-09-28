/**
 * What the partner's app would send its patient when the clinician asks a
 * question: a text in the partner's own name, pointing back to where the
 * patient answers. Shown, not sent — Lithos never contacts the patient, and
 * sending is the partner's own SMS or email provider. The question itself stays
 * out of the text: health details belong behind the patient's login.
 */
export function PatientNotification({ brandName, patientFirstName }: { brandName: string; patientFirstName: string }) {
  return (
    <div className="sms" aria-label={`Text message from ${brandName}`}>
      <p className="sms-from">{brandName}</p>
      <p className="chat-bubble chat-bubble-app">
        Hi {patientFirstName}, the clinician reviewing your request has a question before they decide. Answer here:{" "}
        <span className="sms-link">{brandName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com/care</span>
      </p>
    </div>
  );
}
