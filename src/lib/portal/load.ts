import { cache } from "react";
import { getLithosClient, type LithosClient } from "@/lib/lithos/client";
import type { CarePlan, Inquiry, ListResponse, PatientListItem } from "@/lib/lithos/types";
import { readPortalPatientId } from "./session";
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

/** The organization's patients, newest first, for the demo sign-in. */
export async function listPatients(client: LithosClient): Promise<PatientListItem[]> {
  return (await client.get<ListResponse<PatientListItem>>("/v1/patients?limit=25")).data;
}

/**
 * The signed-in patient's portal, once per request — the shell and the page
 * both read it. Undefined when nobody is signed in.
 */
export const signedInPortal = cache(async (): Promise<PortalData | undefined> => {
  const patientId = await readPortalPatientId();
  return patientId ? loadPortal(getLithosClient(), patientId) : undefined;
});
