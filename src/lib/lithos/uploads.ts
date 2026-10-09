import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LithosClient, RequestOptions } from "./client";
import { LithosApiError } from "./errors";

type UploadSlot = { id: string; upload_url: string; upload_headers: Record<string, string> };

/**
 * A file into Lithos, the way every upload goes: reserve a one-time slot
 * (`POST /v1/uploads` with the size and MD5), `PUT` the bytes to the presigned
 * URL it returns, then send the slot's `id` on the call that creates the
 * resource — here an intake's `*_upload_id` field on `POST /v1/encounters`.
 * The id is redeemed exactly once; Lithos checks the bytes against the MD5.
 */
export async function uploadFile(
  client: LithosClient,
  file: { filename: string; contentType: string; bytes: Buffer },
  options: RequestOptions = {},
): Promise<string> {
  const slot = await client.post<UploadSlot>("/v1/uploads", {
    filename: file.filename,
    content_type: file.contentType,
    byte_size: file.bytes.byteLength,
    checksum: createHash("md5").update(file.bytes).digest("base64"),
  }, options);
  const put = await fetch(slot.upload_url, { method: "PUT", headers: slot.upload_headers, body: new Uint8Array(file.bytes) });
  if (!put.ok) {
    throw new LithosApiError(put.status, [{ code: "upload.put_failed", message: `The storage URL refused the file (HTTP ${put.status}).` }]);
  }
  return slot.id;
}

/**
 * A sample image from public/samples/. In the sandbox the intake sends these
 * instead of photos of a real person — your own app would upload what the
 * patient took.
 */
export async function sampleImage(name: string): Promise<{ filename: string; contentType: string; bytes: Buffer }> {
  if (!/^[a-z0-9-]+\.png$/.test(name)) throw new Error(`Not a sample image: ${name}`);
  return { filename: name, contentType: "image/png", bytes: await readFile(path.join(process.cwd(), "public", "samples", name)) };
}
