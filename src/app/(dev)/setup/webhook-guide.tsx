import { RunAgainButton } from "./step-actions";

/**
 * How to actually do steps 5 and 6. The checks can tell you whether a webhook
 * arrived; they can't give you a public address or tell you when to look. This
 * is the part a stranger can't guess.
 */

/** Step 5: getting a public HTTPS address, then registering it. */
export function EndpointGuide() {
  return (
    <div className="setup-guide stack">
      <h3>1. Give this app a public HTTPS address</h3>
      <p>
        Lithos delivers webhooks over the internet, so it can&rsquo;t reach <code>localhost</code>. Pick one:
      </p>
      <div className="setup-guide-options">
        <div>
          <p><strong>A tunnel</strong> — quickest; the app keeps running on your machine.</p>
          <pre className="setup-json">{`brew install cloudflared      # once
cloudflared tunnel --url http://localhost:3001`}</pre>
          <p className="muted">
            It prints an address like <code>https://something.trycloudflare.com</code>. Keep that terminal open. The
            address changes every time you restart it, so you&rsquo;ll re-point the endpoint when it does.
          </p>
        </div>
        <div>
          <p><strong>Deploy it</strong> — a stable address.</p>
          <pre className="setup-json">{`npx vercel deploy --prod`}</pre>
          <p className="muted">
            Add the four <code>LITHOS_</code> values in the project&rsquo;s environment settings, and turn{" "}
            <strong>Deployment Protection</strong> off — otherwise Vercel answers Lithos with a 401 before your app sees
            anything. A deployed copy also needs somewhere to keep events: <code>DATABASE_URL</code> or Upstash.
          </p>
        </div>
      </div>
      <h3>2. Register the address</h3>
      <p>
        Paste it below. First the app checks the address really reaches <em>it</em> — so a placeholder, a typo, a stopped
        tunnel or Vercel&rsquo;s protection is caught here, not after Lithos has started failing deliveries in silence.
        Then Lithos returns a signing secret — once — and you&rsquo;ll add it to <code>.env.local</code>.
      </p>
    </div>
  );
}

/** Step 6: what makes a delivery happen, and what to check when one doesn't. */
export function DeliveryGuide({ secretSet }: { secretSet: boolean }) {
  return (
    <div className="setup-guide stack">
      {!secretSet && (
        <p className="demo-note">
          <strong>This app can&rsquo;t verify deliveries yet:</strong> <code>LITHOS_WEBHOOK_SECRET</code> isn&rsquo;t set, so
          it refuses every delivery — on purpose. Lithos showed the secret once, when you registered; if you don&rsquo;t
          have it, get a new one below.
        </p>
      )}
      <h3>How to make one arrive</h3>
      <p>
        Webhooks follow real events — an encounter created, reviewed, completed. Lithos sends each one to the endpoint
        registered <em>at that moment</em>, so anything you did before step 5 went nowhere. Make something new happen:
      </p>
      <ul>
        <li>run steps 3–4 again with a new patient — the button below clears the old one and takes you there; or</li>
        <li>submit a care review on the site — the same calls, made by the app.</li>
      </ul>
      <div>
        <RunAgainButton variant="primary" />
      </div>
      <p className="muted">Deliveries usually land within seconds. Reload this page to check.</p>
    </div>
  );
}
