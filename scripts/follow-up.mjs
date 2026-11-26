// Submit a treat-to-target recheck for a member whose treatment is refill-eligible.
//
//   npm run follow-up -- eu_mem_nakamura thr_test_… 96 [add_agent_slug]
//
// Transcribes the recheck LDL-C into Eucardia's record, applies the protocol's
// follow-up branch on the partner side, and POSTs the follow-up encounter with
// a refill line (plus an `add` line when still above target and an agent is
// named). Prints the decision and what Lithos stored.
try { const { loadEnvConfig } = await import("@next/env"); loadEnvConfig(process.cwd()); } catch {}
// DATABASE_URL, or the database the running app started (db/running.mjs).
process.env.DATABASE_URL = (await import("../db/running.mjs")).requireDatabaseUrl();
import { followUpMember } from "../src/lib/follow-up";
import { getLithosClient } from "../src/lib/lithos/client";

const [memberId, treatmentId, ldlArg, addAgent] = process.argv.slice(2);
if (!memberId || !treatmentId || !ldlArg) {
  console.error("usage: npm run follow-up -- <member_id> <treatment_id> <ldl_c> [add_agent_slug]");
  process.exit(1);
}
for (const name of ["DATABASE_URL", "LITHOS_CLIENT_ID", "LITHOS_CLIENT_SECRET"]) {
  if (!process.env[name]) { console.error(`${name} is not set.`); process.exit(1); }
}

const today = new Date().toISOString().slice(0, 10);
const result = await followUpMember({
  memberId,
  treatmentId,
  recheck: { drawn_on: today, ldl_c: Number(ldlArg), apo_b: 72, hba1c: 5.7, hdl_c: 50, triglycerides: 128, total_cholesterol: 168, cmp: { alt: 24, ast: 21, egfr: 88 } },
  adherence: "on_schedule",
  sideEffects: [],
  healthChanges: "No new diagnoses. No change to other medications.",
  addAgent: addAgent || undefined,
});

console.log(`\n${memberId} follow-up → ${result.status.toUpperCase()}`);
if (result.status === "blocked") {
  console.log(`  ${result.reason}`);
} else if (result.status === "failed") {
  console.log(`  HTTP ${result.httpStatus}`);
  for (const e of result.errors) console.log(`  ${e.code}: ${e.message}${e.source?.pointer ? ` @ ${e.source.pointer}` : ""}`);
} else {
  console.log(`  decision   ${result.decision}`);
  console.log(`  lines      ${JSON.stringify(result.lines)}`);
  console.log(`  encounter  ${result.encounterId}  ${result.encounter.status}  type=${result.encounter.encounter_type}`);
  console.log(`  requested  ${JSON.stringify((result.encounter.requested_treatments ?? []).map((t) => ({ id: t.id, action: t.action, status: t.status, catalog_treatment_id: t.catalog_treatment_id, treatment_id: t.treatment_id })))}`);
  const stored = await getLithosClient().get(`/v1/encounters/${result.encounterId}`);
  console.log(`  intake keys stored (${Object.keys(stored.intake_form?.data ?? {}).length}): ${Object.keys(stored.intake_form?.data ?? {}).join(", ")}`);
}
console.log();
process.exit(0);
