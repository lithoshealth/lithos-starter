// Runtime smoke of Eucardia's DB layer — no Lithos calls.
//
//   npm run db:smoke
//
// Exercises the parts TypeScript can't check: the postgres helper inside
// INSERT … ON CONFLICT DO UPDATE, sql.json, and idempotent event recording.
// Writes then deletes its own rows against the seeded member eu_mem_rivera.
try { const { loadEnvConfig } = await import("@next/env"); loadEnvConfig(process.cwd()); } catch {}
import { PostgresEventStore } from "../src/lib/events/postgres-store";
import { upsertCarePlan, upsertEncounter, markProcessed } from "../src/lib/projections";
import { getDb } from "../src/lib/db";

if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set."); process.exit(1); }

const store = new PostgresEventStore();
const ev = { id: "evt_test_smoke_1", receivedAt: new Date().toISOString(),
  payload: { id: "evt_test_smoke_1", type: "encounter.created", resource_id: "enc_test_smoke", created_at: "2026-09-16T00:00:00Z" } };
console.log("store.record #1        ", await store.record(ev));
console.log("store.record #2 (dup)  ", await store.record(ev));
console.log("store.list(3)          ", (await store.list(3)).map((e) => e.id));
await markProcessed("evt_test_smoke_1", "smoke: not projected");

const plan = { id: "cpl_test_smoke", patient_id: "pat_test_smoke", category: "lipid_management", status: "pending_review",
  clinician_notes: null, created_at: "2026-09-16T00:00:00Z", updated_at: "2026-09-16T00:00:00Z", active_at: null, ineligible_at: null, clinician: null, treatments: [] };
await upsertCarePlan("eu_mem_rivera", plan);
await upsertCarePlan("eu_mem_rivera", { ...plan, status: "active", active_at: "2026-09-16T01:00:00Z" });

const enc = { id: "enc_test_smoke", patient_id: "pat_test_smoke", status: "pending_review", created_at: "2026-09-16T00:00:00Z",
  care_plan_id: "cpl_test_smoke", encounter_type: "initial", escalation_reason: null, updated_at: "2026-09-16T00:00:00Z",
  completed_at: null, canceled_at: null, care_plan: { status: "pending_review", category: "lipid_management", clinician_notes: null },
  clinician: null, requested_treatments: [], orders: [], patient_message: null };
await upsertEncounter("eu_mem_rivera", enc);
await upsertEncounter("eu_mem_rivera", { ...enc, status: "in_review", updated_at: "2026-09-16T02:00:00Z" });

const sql = getDb();
console.log("care_plans row         ", await sql`SELECT lithos_care_plan_id, status, activated_at FROM care_plans WHERE lithos_care_plan_id = 'cpl_test_smoke'`);
console.log("encounters row         ", await sql`SELECT lithos_encounter_id, status, (raw->>'status') AS raw_status FROM encounters WHERE lithos_encounter_id = 'enc_test_smoke'`);
console.log("webhook_events row     ", await sql`SELECT id, processed_at IS NOT NULL AS processed, process_error FROM webhook_events WHERE id = 'evt_test_smoke_1'`);

await sql`DELETE FROM encounters WHERE lithos_encounter_id = 'enc_test_smoke'`;
await sql`DELETE FROM care_plans WHERE lithos_care_plan_id = 'cpl_test_smoke'`;
await sql`DELETE FROM webhook_events WHERE id = 'evt_test_smoke_1'`;
await sql.end();
console.log("cleaned up");
