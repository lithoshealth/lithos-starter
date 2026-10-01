// What happens when a Eucardia member is escalated to Lithos medical care?
//
//   npm run escalation:preview -- eu_mem_rivera
//
// Builds the escalation plan without calling Lithos: the hard stops the partner
// must enforce, what maps onto declared fields, what goes across as undeclared
// extras (stored and shown, validated by nobody), and what has to be asked.
//
// Loads the member through getMemberRecord — the same path the app uses — so a
// new field on the record can't silently go missing here.
try { const { loadEnvConfig } = await import("@next/env"); loadEnvConfig(process.cwd()); } catch {}
// DATABASE_URL, or the database the running app started (db/running.mjs).
process.env.DATABASE_URL = (await import("../db/running.mjs")).requireDatabaseUrl();
import { buildEscalationPlan } from "../src/lib/escalation";
import { getMemberRecord } from "../src/lib/members";
import { getDb } from "../src/lib/db";

const memberId = process.argv[2] ?? "eu_mem_rivera";
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (source .env.local first).");
  process.exit(1);
}

const record = await getMemberRecord(memberId);
if (!record) { console.error(`No member ${memberId}`); process.exit(1); }
const { member, panels, notes, medications } = record;
const plan = buildEscalationPlan(record);
const months = Math.round((Date.now() - new Date(member.joined_at).getTime()) / (30 * 86_400_000));

console.log(`\n${member.first_name} ${member.last_name}  ·  ${member.id}`);
console.log(`Eucardia holds ${panels.length} lab panel(s), ${notes.length} coach note(s), ${medications.length} medication record(s) over ~${months} month(s).\n`);

console.log(`HARD STOPS (partner-enforced) — ${plan.eligible ? "eligible" : "BLOCKED"}`);
for (const h of plan.hardStops) console.log(`  ${h.triggered ? "✗" : "✓"} ${h.rule.padEnd(44)} ${h.basis}`);
if (plan.flags.length) { console.log("\nFLAGS TO THE MD"); for (const f of plan.flags) console.log(`  ⚑ ${f}`); }

console.log("\nDECLARED FIELDS (validated by Lithos)");
for (const c of plan.carried) console.log(`  ${c.field.padEnd(30)} ${String(c.value).padEnd(30)} ← ${c.from}`);

console.log("\nSENT AS UNDECLARED EXTRAS (stored + shown to the reviewer, validated by nobody)");
if (plan.sentUndeclared.length === 0) console.log("  (none — this member has LDL-C only)");
for (const c of plan.sentUndeclared) console.log(`  ${c.field.padEnd(30)} ${String(c.value).padEnd(30)} ← ${c.from}`);

console.log("\nMUST BE ASKED / DRAWN BEFORE AN ENCOUNTER CAN BE CREATED");
for (const a of plan.mustAsk) console.log(`  [${a.kind}] ${a.what}\n      ${a.why}`);

console.log(`\nexternal_id → ${plan.patient.external_id}`);
console.log(`intake keys → ${Object.keys(plan.intake).join(", ")}`);
if (plan.intake.current_lipid_medications) console.log(`current_lipid_medications → ${JSON.stringify(plan.intake.current_lipid_medications)}`);
if (plan.intake.medications_allergies) console.log(`medications_allergies → ${JSON.stringify(plan.intake.medications_allergies)}`);
console.log(`partner_context → ${plan.intake.partner_context}\n`);

await getDb().end();
