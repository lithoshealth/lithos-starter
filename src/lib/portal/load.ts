import { cache } from "react";
import { getLithosClient, type LithosClient } from "@/lib/lithos/client";
import type { CarePlan, Inquiry, ListResponse, PatientListItem } from "@/lib/lithos/types";
import { getDb, isDbConfigured } from "@/lib/db";
import { readPortalIdentity } from "./session";
import type { CatalogEntry, Order, PortalData, PortalEncounter, PortalPatient } from "./view";

/** How many requests back the portal reads. Plenty for a demo; a real app would page. */
const RECENT = 10;
/** Conversations read in full, newest first. */
const THREADS = 5;

/**
 * Everything the portal shows about one patient, read live from Lithos — no
 * local copy. Encounters are re-read one by one because only the show endpoint
 * carries the intake (where progress readings come from); the latest few
 * conversations the same way, for their messages.
 */
export async function loadPortal(client: LithosClient, patientId: string): Promise<PortalData> {
  const id = encodeURIComponent(patientId);
  const [patient, carePlans, encounterList, orders, inquiryList, catalog] = await Promise.all([
    client.get<PortalPatient>(`/v1/patients/${id}`),
    client.get<ListResponse<CarePlan>>(`/v1/care_plans?patient_id=${id}`),
    client.get<ListResponse<{ id: string }>>(`/v1/encounters?patient_id=${id}&limit=${RECENT}`),
    client.get<ListResponse<Order>>(`/v1/orders?patient_id=${id}`),
    client.get<ListResponse<Inquiry>>(`/v1/patients/${id}/inquiries`),
    client.get<{ data: Array<CatalogEntry & { id: string }> }>("/v1/catalog_treatments"),
  ]);

  const [encounters, inquiries] = await Promise.all([
    Promise.all(encounterList.data.map((e) => client.get<PortalEncounter>(`/v1/encounters/${encodeURIComponent(e.id)}`))),
    Promise.all(inquiryList.data.map((i, index) =>
      i.status === "open" || index < THREADS ? client.get<Inquiry>(`/v1/inquiries/${encodeURIComponent(i.id)}`) : Promise.resolve(i))),
  ]);

  return {
    patient,
    carePlans: carePlans.data,
    encounters,
    orders: orders.data,
    inquiries,
    catalog: Object.fromEntries(catalog.data.map(({ id: key, name, form, presentation }) => [key, { name, form, presentation }])),
  };
}

/** Someone to sign in as: a member from your records, or (with no database) a Lithos patient. */
export type SignInChoice = {
  kind: "member" | "patient";
  id: string;
  firstName: string;
  lastName: string;
  since: string;
  /** "Essential member", "Care only", "No care yet" — what they are to the brand. */
  note: string;
};

/**
 * Who can sign in, newest first: the people in your own records — the
 * patient app's users are your users. With no database, the organization's
 * Lithos patients instead.
 */
export async function listSignInChoices(client: LithosClient): Promise<SignInChoice[]> {
  if (isDbConfigured()) {
    const rows = await getDb()<Array<{ id: string; first_name: string; last_name: string; plan: string | null; lithos_patient_id: string | null; created_at: Date }>>`
      SELECT id, first_name, last_name, plan, lithos_patient_id, created_at FROM members ORDER BY created_at DESC LIMIT 25`;
    return rows.map((m) => ({
      kind: "member",
      id: m.id,
      firstName: m.first_name,
      lastName: m.last_name,
      since: m.created_at.toISOString(),
      note: [m.plan ? `${m.plan[0].toUpperCase()}${m.plan.slice(1)} member` : "Care only", m.lithos_patient_id ? null : "no care yet"].filter(Boolean).join(" · "),
    }));
  }
  const patients = (await client.get<ListResponse<PatientListItem>>("/v1/patients?limit=25")).data;
  return patients.map((p) => ({ kind: "patient", id: p.id, firstName: p.first_name, lastName: p.last_name, since: p.created_at, note: "Lithos patient" }));
}

/** Who's signed in, as the app knows them: the member, and their Lithos patient once they have one. */
export type SignedIn = { member?: { id: string; firstName: string; lastName: string }; patientId?: string };

export async function signedIn(): Promise<SignedIn | undefined> {
  const identity = await readPortalIdentity();
  if (!identity) return undefined;
  if ("patientId" in identity) return { patientId: identity.patientId };
  if (!isDbConfigured()) return undefined;
  const [member] = await getDb()<Array<{ id: string; first_name: string; last_name: string; lithos_patient_id: string | null }>>`
    SELECT id, first_name, last_name, lithos_patient_id FROM members WHERE id = ${identity.memberId}`;
  if (!member) return undefined;
  return { member: { id: member.id, firstName: member.first_name, lastName: member.last_name }, patientId: member.lithos_patient_id ?? undefined };
}

/**
 * The signed-in person's portal, once per request — the shell and the page
 * both read it. `care` is undefined for a member who hasn't asked for care yet.
 */
export const signedInPortal = cache(async (): Promise<{ who: SignedIn; care?: PortalData } | undefined> => {
  const who = await signedIn();
  if (!who) return undefined;
  return { who, care: who.patientId ? await loadPortal(getLithosClient(), who.patientId) : undefined };
});
