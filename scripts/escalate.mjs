// Push a member into Lithos medical care, for real, against the sandbox.
//
//   npm run escalate -- eu_mem_rivera [catalog_treatment_id] ['{"established_atherosclerotic_cardiovascular_disease":true}']
//
// Screening answers default to "no" (synthetic member); pass a JSON object to
// set any of the eight. Consent is taken now. Prints the stages, the
// reconciliation outcome, and what Lithos stored.
try { const { loadEnvConfig } = await import("@next/env"); loadEnvConfig(process.cwd()); } catch {}
import { escalateMember } from "../src/lib/escalate";
import { getLithosClient } from "../src/lib/lithos/client";
import { getDb } from "../src/lib/db";
import { newAttempt } from "../src/lib/lithos/idempotency";

const memberId = process.argv[2] ?? "eu_mem_rivera";
const catalogTreatmentId = process.argv[3] || undefined;
const overrides = process.argv[4] ? JSON.parse(process.argv[4]) : {};
for (const name of ["DATABASE_URL", "LITHOS_CLIENT_ID", "LITHOS_CLIENT_SECRET"]) {
  if (!process.env[name]) { console.error(`${name} is not set (source .env.local first).`); process.exit(1); }
}

const result = await escalateMember({
  memberId,
  screening: {
    established_atherosclerotic_cardiovascular_disease: false, recent_cardiac_condition: false,
    drug_hypersensitivity: false, cirrhosis: false, severe_hepatic_impairment: false,
    severe_renal_impairment: false, pregnancy: false, currently_taking_cyclosporine: false,
    ...overrides,
  },
  attempt: newAttempt(),
  catalogTreatmentId,
});

console.log(`\n${memberId} → ${result.status.toUpperCase()}${catalogTreatmentId ? `  (requested ${catalogTreatmentId})` : "  (provider-choice line)"}`);

if (result.status === "blocked") {
  for (const h of result.plan.hardStops.filter((h) => h.triggered)) console.log(`  ✗ ${h.rule} — ${h.basis}`);
} else if (result.status === "failed") {
  console.log(`  stage ${result.stage} · HTTP ${result.httpStatus}`);
  for (const e of result.errors) console.log(`  ${e.code}: ${e.message}${e.source?.pointer ? ` @ ${e.source.pointer}` : ""}${e.meta ? ` meta=${JSON.stringify(e.meta)}` : ""}`);
  if (result.patientId) console.log(`  patient retained: ${result.patientId}`);
} else {
  console.log(`  patient    ${result.patientId}${result.linkedToExisting ? "  (linked to EXISTING patient via external_id conflict)" : "  (created)"}`);
  console.log(`  care plan  ${result.carePlanId}`);
  console.log(`  encounter  ${result.encounterId}  ${result.encounter.status}`);
  const lines = result.encounter.requested_treatments ?? [];
  console.log(`  requested_treatments: ${JSON.stringify(lines.map((t) => ({ id: t.id, status: t.status, catalog_treatment_id: t.catalog_treatment_id })))}`);

  const stored = await getLithosClient().get(`/v1/encounters/${result.encounterId}`);
  const data = stored.intake_form?.data ?? {};
  console.log(`\n  intake keys stored by Lithos (${Object.keys(data).length}): ${Object.keys(data).join(", ")}`);

  const sql = getDb();
  const [m] = await sql`SELECT id, lithos_patient_id, lithos_linked_at FROM members WHERE id = ${memberId}`;
  const [e] = await sql`SELECT lithos_encounter_id, status FROM encounters WHERE member_id = ${memberId} ORDER BY synced_at DESC LIMIT 1`;
  console.log(`\n  local: members.lithos_patient_id = ${m?.lithos_patient_id}  linked ${m?.lithos_linked_at ? new Date(m.lithos_linked_at).toISOString() : "—"}`);
  console.log(`  local: encounters projection → ${e?.lithos_encounter_id} ${e?.status}`);
  await sql.end();
}
console.log();
