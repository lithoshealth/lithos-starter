import "server-only";
import { photosFor } from "./intake/derm";
import { samplePdf } from "./journey-labs";
import { APPROVAL_DOCUMENT_PROGRAMS } from "./intake/wellness";
import { getLithosClient } from "./lithos/client";
import { sampleImage, uploadFile } from "./lithos/uploads";
import type { JourneyInput } from "./journey";

/**
 * The photos an intake needs, uploaded and added as its `*_upload_id` fields.
 * The sandbox sends the sample images in public/samples/ — your app would send
 * what the patient took. Each upload is keyed from the attempt, so a double
 * submit reserves each slot once.
 */
export async function attachSamplePhotos(
  program: string,
  intake: JourneyInput["intake"],
  key: (step: string) => { idempotencyKey: string },
): Promise<JourneyInput["intake"]> {
  const data = intake as Record<string, unknown>;
  const photos = photosFor(program, data);
  // Eyelash growth after chemotherapy needs the treating physician's clearance;
  // B12 and Oxytocin after recent cancer treatment, the oncologist's approval.
  const clearance = program === "eyelash_growth" && data.chemotherapy_history === true;
  const approval = APPROVAL_DOCUMENT_PROGRAMS.includes(program)
    && data.cancer_treatment_last_3_years === true && data.oncologist_approval === true;
  if (photos.length === 0 && !clearance && !approval) return intake;
  const client = getLithosClient();
  const ids = await Promise.all(photos.map(async (photo) => [photo.field, await uploadFile(client, await sampleImage(photo.sample), key(`upload-${photo.field}`))] as const));
  if (clearance) {
    const letter = samplePdf("sample-medical-clearance.pdf", "Sample medical clearance: synthetic patient, Lithos sandbox only");
    ids.push(["chemotherapy_clearance_upload_id", await uploadFile(client, letter, key("upload-chemotherapy-clearance"))]);
  }
  if (approval) {
    const letter = samplePdf("sample-oncologist-approval.pdf", "Sample oncologist approval: synthetic patient, Lithos sandbox only");
    ids.push(["oncologist_approval_upload_id", await uploadFile(client, letter, key("upload-oncologist-approval"))]);
  }
  return { ...data, ...Object.fromEntries(ids) };
}
