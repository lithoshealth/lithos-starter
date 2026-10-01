import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { clinicianFullName, currentThread, newestPlan, type Clinician, type PortalData } from "@/lib/portal/view";
import { Composer } from "../composer";
import { portalPageState } from "../page-state";
import { PortalShell, initials } from "../shell";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

/**
 * Messages: the conversation with the care team, as a chat. Lithos keeps the
 * thread (an inquiry) and the clinician answers in it; this app shows it and
 * relays what the patient writes.
 */
export default async function Messages({ searchParams }: { searchParams: Promise<{ thread?: string; draft?: string }> }) {
  const state = await portalPageState();
  if (state.kind === "screen") return state.screen;
  if (state.kind === "signed_out") redirect("/portal");
  const { thread: threadId, draft } = await searchParams;
  return <Chat data={state.data} threadId={threadId} draft={draft} />;
}

function Chat({ data, threadId, draft }: { data: PortalData; threadId?: string; draft?: string }) {
  const zone = data.patient.time_zone ?? "UTC";
  const stamp = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: zone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const thread = (threadId && data.inquiries.find((i) => i.id === threadId)) || currentThread(data);
  const others = data.inquiries.filter((i) => i.id !== thread?.id);
  const clinician = (newestPlan(data)?.clinician ?? data.patient.assigned_clinician) as Clinician;
  const name = clinicianFullName(clinician);
  // A closed conversation can't take new messages; writing starts a fresh one.
  const replyTo = thread?.status === "open" ? thread.id : undefined;

  return (
    <PortalShell tab="messages" data={data} eyebrow="Your care team" title="Messages" lede={`${name} and your care team, here when you need them.`}>
      <section className="chat" aria-label="Conversation">
        <header className="chat-head">
          {clinician?.profile_picture_url
            // eslint-disable-next-line @next/next/no-img-element -- a clinician's photo from Lithos, any size
            ? <img src={clinician.profile_picture_url} alt="" className="chat-photo" />
            : <span className="chat-photo">{initials(String(clinician?.first_name ?? "C"), String(clinician?.last_name ?? "T"))}</span>}
          <span>
            <strong>{name}</strong>
            <span className="muted">{thread?.subject ?? "Your clinician"}</span>
          </span>
        </header>

        <ol className="chat-log">
          {thread?.messages?.length ? thread.messages.map((m) => {
            const mine = m.sender.type === "patient";
            return (
              <li key={m.id} className={mine ? "chat-msg chat-mine" : "chat-msg"}>
                <p className="chat-bubble">{m.body}</p>
                <span className="chat-time">{stamp(m.created_at)}</span>
              </li>
            );
          }) : (
            <li className="chat-empty">Ask anything about your care. A clinician answers here.</li>
          )}
        </ol>

        <Composer threadId={replyTo} draft={draft} />
      </section>

      {others.length > 0 && (
        <section className="card-soft" aria-label="Earlier conversations">
          <h2 className="card-heading">Earlier conversations</h2>
          <ul className="chat-others">
            {others.map((t) => (
              <li key={t.id}>
                <Link href={`/portal/messages?thread=${encodeURIComponent(t.id)}`}>
                  <strong>{t.subject ?? "Conversation"}</strong>
                  <span className="muted">{t.status === "open" ? "Open" : "Resolved"} · {stamp(t.last_message_at ?? t.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PortalShell>
  );
}
