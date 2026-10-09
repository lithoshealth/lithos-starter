import type { Exchange, StepState } from "@/lib/setup/steps";

// What the Developer pages share: a step's status badge, what Lithos returned,
// and what to do when something's wrong.

/** Lithos's API reference — the same link Lithos sends with sandbox credentials. */
export const API_DOCS_URL = "https://docs.lithoshealth.com";

export const BADGE: Record<StepState["status"], { label: string; className: string }> = {
  done: { label: "Done", className: "badge-success" },
  ready: { label: "Your turn", className: "badge-info" },
  blocked: { label: "Needs a fix", className: "badge-error" },
  locked: { label: "Waiting", className: "badge-outline" },
};

/**
 * A list call that came back empty — labelled "nothing yet", so a folded
 * `{ "data": [] }` isn't mistaken for a result worth opening.
 */
function isEmptyResponse(response: unknown): boolean {
  const data = (response as { data?: unknown } | null | undefined)?.data;
  return Array.isArray(data) && data.length === 0;
}

export function Json({ value }: { value: unknown }) {
  return <pre className="setup-json">{JSON.stringify(value, null, 2)}</pre>;
}

export function Exchanges({ step }: { step: StepState }) {
  return (
    <>
      {[step.exchange, ...(step.moreExchanges ?? [])].filter((x): x is Exchange => Boolean(x)).map((exchange) => (
        <details key={`${exchange.method} ${exchange.path}`} className="setup-detail setup-detail-api">
          <summary>
            {exchange.direction === "inbound" ? "What Lithos sent" : "What Lithos returned"} — <code>{exchange.method} {exchange.path}</code>
            {exchange.status ? ` · ${exchange.status}` : ""}
            {isEmptyResponse(exchange.response) ? " · nothing yet" : ""}
          </summary>
          {exchange.note && <p className="muted">{exchange.note}</p>}
          <Json value={exchange.response} />
        </details>
      ))}
    </>
  );
}

export function Diagnosis({ step }: { step: StepState }) {
  if (!step.diagnosis) return null;
  return (
    <div className={step.status === "blocked" ? "error-box" : "demo-note"}>
      <h2>{step.diagnosis.title}</h2>
      <p>{step.diagnosis.fix}</p>
      {step.diagnosis.command && <pre className="setup-command">{step.diagnosis.command}</pre>}
      {step.diagnosis.then && <p>{step.diagnosis.then}</p>}
    </div>
  );
}

