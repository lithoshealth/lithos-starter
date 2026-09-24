import type { QuestionThread } from "@/lib/setup/steps";
import { InboxThread } from "./inbox-thread";
import { PatientNotification } from "./patient-notification";
import { AskQuestionForm, OpenSetupButton, WaitForWebhook } from "./question-demo";

type Question = { asked: boolean; heardAt?: string; thread?: QuestionThread };

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

/**
 * Step 5 as one worked example: a clinician's question on its way to the
 * patient, stop by stop. Lithos can't reach the patient — only the partner's
 * app can — so the question has to travel through the app, and the webhook is
 * how the app hears it.
 */
export function WebhookDemo({ question, canAsk, blocked, brandName, clinicianQuestion, patientReply }: {
  question?: Question; canAsk: boolean; blocked: boolean; brandName: string; clinicianQuestion: string; patientReply: string;
}) {
  const asked = Boolean(question?.asked);
  const heard = question?.heardAt && question.thread;
  return (
    <section id="webhook-demo" className="webhook-demo" aria-label="Try it: the clinician asks your patient a question">
      <p className="eyebrow">Try it</p>
      <ol className="flow">
        <li className={asked ? "flow-stop flow-done" : "flow-stop flow-current"}>
          <p className="flow-who">The clinician, in Lithos</p>
          {asked && question?.thread ? (
            <p className="chat-bubble chat-bubble-clinician">{question.thread.question}</p>
          ) : (
            <AskQuestionForm question={clinicianQuestion} disabled={!canAsk || asked} />
          )}
          {!canAsk && !asked && (
            <p className="muted">Your app can&rsquo;t hear Lithos yet — it needs a public address and the signing secret. <OpenSetupButton /></p>
          )}
        </li>

        <li className={heard ? "flow-stop flow-done" : asked ? "flow-stop flow-current" : "flow-stop"}>
          <p className="flow-who">Lithos → your app</p>
          {heard ? (
            <p className="flow-status flow-status-done">
              ✓ Heard at <time dateTime={question!.heardAt}>{time(question!.heardAt!)}</time> — <code>inquiry.created</code>, then the
              app read the question with <code>GET /v1/inquiries/{question!.thread!.id}</code>
            </p>
          ) : asked && !blocked ? (
            <WaitForWebhook />
          ) : asked ? (
            <p className="flow-status flow-status-failed">Not heard — see what&rsquo;s wrong below. <OpenSetupButton /></p>
          ) : (
            <p className="muted">A webhook: <code>inquiry.created</code>, signed, sent to your app&rsquo;s public address.</p>
          )}
        </li>

        <li className={heard ? "flow-stop flow-done" : "flow-stop"}>
          <p className="flow-who">Your app → your patient</p>
          {heard ? (
            <>
              <PatientNotification brandName={brandName} patientFirstName="Sample" />
              <p className="muted">Sent by your app, through your own SMS or email provider — Lithos never contacts your patient.</p>
            </>
          ) : (
            <p className="muted">A text or an email, in your name, bringing them back to answer.</p>
          )}
        </li>

        <li className={heard && question!.thread!.awaiting !== "patient" ? "flow-stop flow-done" : heard ? "flow-stop flow-current" : "flow-stop"}>
          <p className="flow-who">Your patient → the clinician</p>
          {heard ? (
            <InboxThread thread={question!.thread!} sampleReply={patientReply} showQuestion={false} />
          ) : (
            <p className="muted">They answer in your app; your app passes it to Lithos.</p>
          )}
        </li>
      </ol>
      {heard && (
        <details className="setup-detail">
          <summary>Ask another question</summary>
          <AskQuestionForm question={clinicianQuestion} again disabled={!canAsk} />
        </details>
      )}
    </section>
  );
}
