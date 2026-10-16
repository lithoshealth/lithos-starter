import "server-only";
import { getLithosClient } from "./lithos/client";
import { connectedOutsideSandbox } from "./lithos/sandbox";
import { uploadFile } from "./lithos/uploads";

/**
 * Lab results a protocol needs before its intake (a cholesterol program needs a
 * recent lipid panel). Lithos says so on GET /v1/encounter_precheck with the
 * reason `labs.required`, and the patient's lab report goes in like this:
 *
 *   POST /v1/uploads → PUT the file          (lib/lithos/uploads.ts)
 *   POST /v1/lab_results { patient_id, upload_id }
 *
 * Lithos then reviews the report (`processing` → `ready`, the `lab_result.ready`
 * webhook) and the precheck passes. Your app would upload the report the
 * patient gives you. The sandbox has no reviewer and no real patients, so here
 * the starter sends a one-page sample report and plays the review with
 * POST /v1/sandbox/lab_results/{id}/simulate_ready, which files in-range values
 * for the tests the care plan needs. Against anything but the sandbox it sends
 * nothing: it never makes up a lab result for a real patient.
 */
export async function fileSampleLabs(
  patientId: string,
  key: (step: string) => { idempotencyKey: string },
): Promise<boolean> {
  if (connectedOutsideSandbox()) return false;
  const client = getLithosClient();
  const uploadId = await uploadFile(client, sampleLabReport(), key("lab-report"));
  const lab = await client.post<{ id: string; status: string }>("/v1/lab_results", { patient_id: patientId, upload_id: uploadId }, key("lab-result"));
  if (lab.status === "processing") {
    await client.post(`/v1/sandbox/lab_results/${encodeURIComponent(lab.id)}/simulate_ready`, {});
  }
  return true;
}

const REPORT_TEXT = "Sample lab report: synthetic patient, Lithos sandbox only";

/** A one-page PDF that says what it is. What's in it doesn't matter in the sandbox. */
export function sampleLabReport(): { filename: string; contentType: string; bytes: Buffer } {
  const stream = `BT /F1 14 Tf 72 720 Td (${REPORT_TEXT}) Tj ET`;
  const pdf = [
    "%PDF-1.4",
    "1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj",
    "2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj",
    "3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj",
    `4 0 obj <</Length ${stream.length}>> stream`,
    stream,
    "endstream endobj",
    "5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj",
    "trailer <</Root 1 0 R>>",
    "%%EOF",
  ].join("\n");
  return { filename: "sample-lab-report.pdf", contentType: "application/pdf", bytes: Buffer.from(pdf) };
}
