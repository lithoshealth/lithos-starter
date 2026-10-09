import "server-only";
import { photosFor } from "./intake/derm";
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
  if (photos.length === 0) return intake;
  const client = getLithosClient();
  const ids = await Promise.all(photos.map(async (photo) => [photo.field, await uploadFile(client, await sampleImage(photo.sample), key(`upload-${photo.field}`))] as const));
  return { ...data, ...Object.fromEntries(ids) };
}
