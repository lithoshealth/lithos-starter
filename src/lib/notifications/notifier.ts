import type { PatientNotification } from "./messages";

/**
 * How a notification reaches the patient. Two ways in the box:
 *
 * - The outbox (default): nothing is sent; the notification is kept, newest
 *   first, and shown on /events — so a demo shows what a patient would get.
 *   It lives in this process's memory: enough for a laptop, not a record.
 * - Email through Resend, when RESEND_API_KEY and NOTIFY_FROM_EMAIL are set —
 *   one fetch, no SDK. Kept in the outbox too, with how it went.
 *
 * Another provider (SMS, push, your email service) is one more `Notifier`.
 */

export type Recipient = { name: string; email: string | null; phone: string | null };

export type Outgoing = { eventId: string; eventType: string; to: Recipient; message: PatientNotification & { url: string } };

export type Sent = Outgoing & { at: string; via: "outbox" | "email"; error?: string };

export interface Notifier {
  send(outgoing: Outgoing): Promise<Sent>;
}

const KEEP = 50;
const globalOutbox = globalThis as unknown as { __patientOutbox?: Sent[] };
const outbox = (globalOutbox.__patientOutbox ??= []);

function keep(sent: Sent): Sent {
  outbox.unshift(sent);
  outbox.length = Math.min(outbox.length, KEEP);
  return sent;
}

/** What went out, or would have, newest first. */
export function listOutbox(): Sent[] {
  return [...outbox];
}

export class OutboxNotifier implements Notifier {
  async send(outgoing: Outgoing): Promise<Sent> {
    return keep({ ...outgoing, at: new Date().toISOString(), via: "outbox" });
  }
}

export class ResendNotifier implements Notifier {
  constructor(private readonly apiKey: string, private readonly from: string, private readonly fetcher: typeof fetch = fetch) {}

  async send(outgoing: Outgoing): Promise<Sent> {
    const sent: Sent = { ...outgoing, at: new Date().toISOString(), via: "email" };
    if (!outgoing.to.email) return keep({ ...sent, error: "no email address on the patient" });
    try {
      const response = await this.fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: this.from,
          to: [outgoing.to.email],
          subject: outgoing.message.subject,
          text: `Hi ${outgoing.to.name},\n\n${outgoing.message.body}\n\n${outgoing.message.url}\n`,
        }),
      });
      return keep(response.ok ? sent : { ...sent, error: `Resend answered ${response.status}` });
    } catch (error) {
      return keep({ ...sent, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export function getNotifier(env: Record<string, string | undefined> = process.env): Notifier {
  return env.RESEND_API_KEY && env.NOTIFY_FROM_EMAIL ? new ResendNotifier(env.RESEND_API_KEY, env.NOTIFY_FROM_EMAIL) : new OutboxNotifier();
}
