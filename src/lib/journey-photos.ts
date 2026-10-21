import "server-only";
import { photosFor } from "./intake/derm";
import { samplePdf } from "./journey-labs";
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
  // Eyelash growth after chemotherapy needs the treating physician's clearance.
  const clearance = program === "eyelash_growth" && data.chemotherapy_history === true;
  if (photos.length === 0 && !clearance) return intake;
  const client = getLithosClient();
  const ids = await Promise.all(photos.map(async (photo) => [photo.field, await uploadFile(client, await sampleImage(photo.sample), key(`upload-${photo.field}`))] as const));
  if (clearance) {
    const letter = samplePdf("sample-medical-clearance.pdf", "Sample medical clearance: synthetic patient, Lithos sandbox only");
    ids.push(["chemotherapy_clearance_upload_id", await uploadFile(client, letter, key("upload-chemotherapy-clearance"))]);
  }
  return { ...data, ...Object.fromEntries(ids) };
}
