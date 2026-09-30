import type { LithosClient } from "@/lib/lithos/client";
import type { CarePlan, Inquiry, ListResponse, Patient, PatientListItem } from "@/lib/lithos/types";
import type { Order, PortalData, PortalEncounter } from "./view";

/** How many requests back the portal reads. Plenty for a demo; a real app would page. */
const RECENT = 10;
/** Conversations shown on the home page. */
const THREADS = 3;

/**
 * Everything the portal shows about one patient, read live from Lithos — no
 * local copy. Encounters are re-read one by one because only the show endpoint
 * carries the intake (where progress readings come from); the latest few
 * conversations the same way, for their messages.
 */
export async function loadPortal(client: LithosClient, patientId: string): Promise<PortalData> {
  const id = encodeURIComponent(patientId);
  const [patient, carePlans, encounterList, orders, inquiryList, catalog] = await Promise.all([
    client.get<Patient>(`/v1/patients/${id}`),
    client.get<ListResponse<CarePlan>>(`/v1/care_plans?patient_id=${id}`),
    client.get<ListResponse<{ id: string }>>(`/v1/encounters?patient_id=${id}&limit=${RECENT}`),
    client.get<ListResponse<Order>>(`/v1/orders?patient_id=${id}`),
    client.get<ListResponse<Inquiry>>(`/v1/patients/${id}/inquiries`),
    client.get<{ data: Array<{ id: string; name: string }> }>("/v1/catalog_treatments"),
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
    treatmentNames: Object.fromEntries(catalog.data.map((t) => [t.id, t.name])),
  };
}

/** The organization's patients, newest first, for the demo sign-in. */
export async function listPatients(client: LithosClient): Promise<PatientListItem[]> {
  return (await client.get<ListResponse<PatientListItem>>("/v1/patients?limit=25")).data;
}
