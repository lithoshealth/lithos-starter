// Seeds Eucardia's system of record with a membership that predates Lithos.
//
//   node db/seed.mjs
//
// Non-destructive and re-runnable. Members are upserted on their stable ids,
// but a member's Lithos link (`lithos_patient_id`, `lithos_linked_at`) is never
// overwritten — a re-seed after a live escalation must not orphan the patient
// on the Lithos side. Child rows have deterministic ids and are inserted only
// if absent. Projections and the webhook event log are never touched.
//
// Names, emails and phones satisfy the synthetic-data guards in
// src/lib/journey.ts, so any member here can be escalated for real. Every
// member is 18–64 and off government insurance (platform hard stops).
import postgres from "postgres";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Start Postgres and export it, e.g.\n" +
    "  export DATABASE_URL=postgres://$(whoami)@localhost:5432/eucardia");
  process.exit(1);
}
const sql = postgres(url, { max: 1 });

const TODAY = new Date("2026-09-16T00:00:00Z");
const day = (n) => new Date(TODAY.getTime() - n * 86_400_000);
const iso = (d) => d.toISOString().slice(0, 10);

// Quarterly panels, oldest first. `ldl` drives the story each member tells.
function panels(memberId, series, opts = {}) {
  return series.map(([daysAgo, ldl, apoB, extra = {}], i) => ({
    id: `lab_${memberId.replace("eu_mem_", "")}_${i + 1}`,
    member_id: memberId,
    drawn_on: iso(day(daysAgo)),
    source: extra.source ?? "eucardia",
    ldl_c: ldl,
    apo_b: apoB,
    lp_a: opts.lpa ?? null,
    hdl_c: extra.hdl ?? 52,
    triglycerides: extra.tg ?? 120,
    total_cholesterol: extra.tc ?? null,
    hs_crp: extra.crp ?? null,
    a1c: extra.a1c ?? null,
    notes: extra.notes ?? null,
  }));
}

const base = { lithos_patient_id: null, lithos_linked_at: null, enrolled_in_government_insurance: false };

const members = [
  {
    // The PCSK9 candidate: lifestyle did what it could, statin not tolerated,
    // LDL plateaued well above target. Escalated live on 2026-09-16.
    member: {
      ...base, id: "eu_mem_rivera", email: "sample.rivera@example.com",
      first_name: "Sample", last_name: "Rivera", date_of_birth: "1974-03-22", sex: "female",
      phone: "+12025550118", address_line1: "44 Sample Row", address_line2: null,
      city: "Washington", state: "DC", postal_code: "20001",
      plan: "complete", status: "active", joined_at: day(486).toISOString(),
      coach_name: "Dana Whitfield", stripe_customer_id: "cus_test_rivera",
    },
    panels: panels("eu_mem_rivera", [
      [470, 178.0, 132.0, { tc: 262, tg: 148, crp: 2.4, notes: "Baseline panel at enrolment." }],
      [380, 171.0, 128.0, { tc: 254, tg: 141 }],
      [290, 163.0, 121.0, { tc: 246, tg: 132, notes: "Mediterranean pattern adopted; steady progress." }],
      [198, 159.0, 118.0, { tc: 241, tg: 128 }],
      [107, 164.0, 123.0, { tc: 247, tg: 134, notes: "Rosuvastatin 10mg trialled weeks 2-7, stopped for myalgia." }],
      [18, 162.0, 121.0, { tc: 244, tg: 130, crp: 2.1, notes: "Plateau. Lifestyle ceiling reached." }],
    ], { lpa: 78 }),
    target: { ldl: 100.0, apoB: 80.0, rationale: "Primary prevention, intermediate 10-year risk. Lifestyle plateau at 162 after 16 months." },
    notes: [
      [470, "review", "Dana Whitfield", "Enrolment review. Family hx: father MI at 61. Motivated, cooks at home."],
      [381, "diet", "Dana Whitfield", "Shifted to Mediterranean pattern. Swapped butter for olive oil, two fish meals weekly."],
      [292, "activity", "Dana Whitfield", "Walking 8k steps most days, added two resistance sessions."],
      [110, "adherence", "Dana Whitfield", "Started rosuvastatin 10mg via her PCP. Reports calf aching from week 2."],
      [95, "adherence", "Dana Whitfield", "Stopped the statin after discussing with her PCP. Frustrated — diet is dialled in and LDL is stuck."],
      [17, "review", "Dana Whitfield", "Quarterly review. Asked whether there is anything beyond a statin. Flagged for medical review."],
    ],
    vitals: [[470, 79.4, 128, 82], [290, 76.8, 124, 79], [107, 75.2, 122, 78], [18, 74.9, 121, 77]],
    meds: [
      { name: "rosuvastatin 10 mg", kind: "lipid_lowering", startedDaysAgo: 110, stoppedDaysAgo: 95, notes: "Stopped for myalgia after ~6 weeks." },
      { name: "levothyroxine 75 mcg", kind: "other", startedDaysAgo: 900 },
      { name: "No known drug allergies", kind: "allergy" },
    ],
  },
  {
    // A member arriving with LDL-C only: baseline ApoB and Lp(a) can be ordered
    // by the clinician at sign-off, and a stale lab is provider judgment
    // *provided current medications are listed*. This member is that path on purpose:
    // joined days ago, no Eucardia panel yet, one nine-month-old LDL-C from his
    // own doctor, already on a statin.
    member: {
      ...base, id: "eu_mem_abara", email: "test.abara@example.com",
      first_name: "Test", last_name: "Abara", date_of_birth: "1981-06-20", sex: "male",
      phone: "+12025550151", address_line1: "31 Sample Parade", address_line2: null,
      city: "Washington", state: "DC", postal_code: "20003",
      plan: "essential", status: "active", joined_at: day(12).toISOString(),
      coach_name: "Marcus Adeyemi", stripe_customer_id: "cus_test_abara",
    },
    // LDL-C only, from an outside panel, nine months old. No ApoB, no Lp(a).
    panels: [{
      id: "lab_abara_1", member_id: "eu_mem_abara", drawn_on: iso(day(274)), source: "external",
      ldl_c: 128.0, apo_b: null, lp_a: null, hdl_c: null, triglycerides: null,
      total_cholesterol: null, hs_crp: null, a1c: null,
      notes: "Basic lipid panel from his primary care physician. LDL-C only; no ApoB or Lp(a) drawn.",
    }],
    target: { ldl: 100.0, apoB: null, rationale: "Primary prevention. Already on a statin started by his PCP; wants it managed properly." },
    notes: [[10, "review", "Marcus Adeyemi", "Enrolment. On atorvastatin 20 mg from his PCP for about a year. Last bloodwork was nine months ago and he has not been re-tested since."]],
    vitals: [[10, 88.2, 129, 84]],
    meds: [
      { name: "atorvastatin 20 mg", kind: "lipid_lowering", startedDaysAgo: 400, notes: "Started by his primary care physician; taking it daily." },
      { name: "lisinopril 10 mg", kind: "other", startedDaysAgo: 500 },
      { name: "penicillin — rash", kind: "allergy" },
    ],
  },
  {
    // The contrast case for step 5: low-risk, lean, active, no history, no
    // lifestyle trial — eligible under the protocol and has already picked a
    // drug. Invented, not real data. If the reviewer receives the same thing
    // for him as for Rivera, that is the demonstration.
    member: {
      ...base, id: "eu_mem_ashford", email: "sample.ashford@example.com",
      first_name: "Sample", last_name: "Ashford", date_of_birth: "1992-02-14", sex: "male",
      phone: "+12025550140", address_line1: "9 Sample Mews", address_line2: null,
      city: "Washington", state: "DC", postal_code: "20002",
      plan: "essential", status: "active", joined_at: day(9).toISOString(),
      coach_name: null, stripe_customer_id: "cus_test_ashford",
    },
    panels: panels("eu_mem_ashford", [
      [6, 151.0, 108.0, { tc: 221, tg: 74, hdl: 61, crp: 0.6, a1c: 5.1, notes: "First panel. Runs marathons. No symptoms; came in after a wearable flagged 'cholesterol'." }],
    ], { lpa: 12 }),
    target: { ldl: 100.0, apoB: 80.0, rationale: "Low 10-year risk, no family history. Nothing tried yet." },
    notes: [],
    vitals: [[6, 68.4, 112, 70]],
  },
  {
    // Coaching is working. Not everyone needs a prescription — this member is
    // the control case, and the reason a membership business exists at all.
    member: {
      ...base, id: "eu_mem_okafor", email: "sample.okafor@example.com",
      first_name: "Sample", last_name: "Okafor", date_of_birth: "1979-11-04", sex: "male",
      phone: "+12025550132", address_line1: "8 Sample Lane", address_line2: "Apt 3",
      city: "Arlington", state: "VA", postal_code: "22201",
      plan: "essential", status: "active", joined_at: day(300).toISOString(),
      coach_name: "Marcus Adeyemi", stripe_customer_id: "cus_test_okafor",
    },
    panels: panels("eu_mem_okafor", [
      [288, 142.0, 104.0, { tc: 218, tg: 158, a1c: 5.6 }],
      [196, 133.0, 98.0, { tc: 209, tg: 140 }],
      [104, 126.0, 92.0, { tc: 201, tg: 126 }],
      [12, 121.0, 88.0, { tc: 196, tg: 118, notes: "On track without pharmacotherapy." }],
    ]),
    target: { ldl: 115.0, apoB: 90.0, rationale: "Low 10-year risk. Lifestyle-first, reassess in six months." },
    notes: [
      [288, "review", "Marcus Adeyemi", "Enrolment. Sedentary desk job, takeaway 4x/week."],
      [200, "diet", "Marcus Adeyemi", "Cut takeaway to once weekly. Cooking batch meals on Sundays."],
      [100, "activity", "Marcus Adeyemi", "Cycling commute 3x/week. Sleeping better."],
      [11, "review", "Marcus Adeyemi", "Excellent trajectory. No medical escalation indicated."],
    ],
    vitals: [[288, 92.1, 134, 86], [104, 88.3, 128, 82], [12, 86.0, 125, 80]],
  },
  {
    // Heterozygous FH. High LDL that lifestyle will never fix.
    member: {
      ...base, id: "eu_mem_lindqvist", email: "test.lindqvist@example.com",
      first_name: "Test", last_name: "Lindqvist", date_of_birth: "1968-07-30", sex: "male",
      phone: "+12025550145", address_line1: "210 Sample Street", address_line2: null,
      city: "Bethesda", state: "MD", postal_code: "20814",
      plan: "complete", status: "active", joined_at: day(96).toISOString(),
      coach_name: "Dana Whitfield", stripe_customer_id: "cus_test_lindqvist",
    },
    panels: panels("eu_mem_lindqvist", [
      [90, 205.0, 152.0, { tc: 288, tg: 164, crp: 1.8, notes: "Enrolment panel. Genetic testing elsewhere confirmed HeFH." }],
      [8, 198.0, 147.0, { tc: 281, tg: 158, notes: "Marginal change on diet, as expected for HeFH." }],
    ], { lpa: 44 }),
    target: { ldl: 70.0, apoB: 60.0, rationale: "Heterozygous familial hypercholesterolemia. Aggressive target; pharmacotherapy required." },
    notes: [
      [95, "review", "Dana Whitfield", "Enrolment. HeFH confirmed by prior genetic testing. Brother had CABG at 55."],
      [60, "diet", "Dana Whitfield", "Diet already good. Set expectation that lifestyle alone will not reach target."],
      [7, "review", "Dana Whitfield", "Second panel confirms. Needs medical review promptly."],
    ],
    vitals: [[90, 84.6, 138, 88], [8, 83.9, 136, 86]],
  },
  {
    // High Lp(a) with only moderately raised LDL.
    member: {
      ...base, id: "eu_mem_delgado", email: "sample.delgado@example.com",
      first_name: "Sample", last_name: "Delgado", date_of_birth: "1985-01-17", sex: "female",
      phone: "+12025550163", address_line1: "77 Sample Court", address_line2: null,
      city: "Alexandria", state: "VA", postal_code: "22314",
      plan: "complete", status: "active", joined_at: day(210).toISOString(),
      coach_name: "Marcus Adeyemi", stripe_customer_id: "cus_test_delgado",
    },
    panels: panels("eu_mem_delgado", [
      [204, 138.0, 101.0, { tc: 214, tg: 112, notes: "Lp(a) 186 nmol/L — markedly elevated." }],
      [112, 134.0, 98.0, { tc: 209, tg: 108 }],
      [20, 132.0, 96.0, { tc: 206, tg: 105 }],
    ], { lpa: 186 }),
    target: { ldl: 100.0, apoB: 80.0, rationale: "Elevated Lp(a) raises lifetime risk; lower the LDL we can modify." },
    notes: [
      [204, "review", "Marcus Adeyemi", "Enrolment. Lp(a) markedly elevated — explained it is largely genetic and not diet-responsive."],
      [115, "diet", "Marcus Adeyemi", "Good baseline diet. Focus on the modifiable LDL fraction."],
      [19, "review", "Marcus Adeyemi", "Discussed medical review to bring LDL below 100 given Lp(a) burden."],
    ],
    vitals: [[204, 63.2, 118, 74], [20, 62.4, 116, 73]],
  },
  {
    // Secondary prevention: established ASCVD, on a statin, still above the
    // protocol's target — the natural "add a PCSK9 at follow-up" case.
    member: {
      ...base, id: "eu_mem_nakamura", email: "test.nakamura@example.com",
      first_name: "Test", last_name: "Nakamura", date_of_birth: "1963-05-09", sex: "male",
      phone: "+12025550171", address_line1: "5 Sample Way", address_line2: null,
      city: "Rockville", state: "MD", postal_code: "20850",
      plan: "complete", status: "active", joined_at: day(150).toISOString(),
      coach_name: "Dana Whitfield", stripe_customer_id: "cus_test_nakamura",
    },
    panels: panels("eu_mem_nakamura", [
      [144, 126.0, 94.0, { tc: 198, tg: 142, crp: 3.1, a1c: 5.8, notes: "Post-stent 2024. On atorvastatin 40mg elsewhere." }],
      [52, 118.0, 88.0, { tc: 190, tg: 134 }],
      [10, 118.0, 89.0, { tc: 191, tg: 136, a1c: 5.7, notes: "Above secondary-prevention target despite statin." }],
    ]),
    target: { ldl: 70.0, apoB: 60.0, rationale: "Established ASCVD (stent 2024). Secondary prevention target." },
    notes: [
      [148, "review", "Dana Whitfield", "Enrolment after stent. Already on atorvastatin 40mg."],
      [55, "adherence", "Dana Whitfield", "Good adherence. Diet improving."],
      [9, "review", "Dana Whitfield", "Still above target on maximal tolerated statin. Add-on therapy discussion needed."],
    ],
    vitals: [[144, 81.0, 142, 90], [52, 79.1, 132, 84], [10, 78.4, 130, 83]],
    meds: [
      { name: "atorvastatin 40 mg", kind: "lipid_lowering", startedDaysAgo: 700, notes: "Started after the stent, by his cardiologist." },
      { name: "aspirin 81 mg", kind: "other", startedDaysAgo: 700 },
      { name: "metoprolol 25 mg", kind: "other", startedDaysAgo: 700 },
      { name: "No known drug allergies", kind: "allergy" },
    ],
  },
  {
    // Paused membership — the lifecycle state that breaks naive integrations.
    member: {
      ...base, id: "eu_mem_byrne", email: "sample.byrne@example.com",
      first_name: "Sample", last_name: "Byrne", date_of_birth: "1991-09-02", sex: "female",
      phone: "+12025550189", address_line1: "19 Sample Terrace", address_line2: null,
      city: "Washington", state: "DC", postal_code: "20009",
      plan: "essential", status: "paused", joined_at: day(400).toISOString(),
      coach_name: "Marcus Adeyemi", stripe_customer_id: "cus_test_byrne",
    },
    panels: panels("eu_mem_byrne", [
      [396, 131.0, 96.0, { tc: 204, tg: 98 }],
      [300, 128.0, 94.0, { tc: 201, tg: 96, notes: "Membership paused shortly after." }],
    ]),
    target: { ldl: 115.0, apoB: 90.0, rationale: "Low risk, young. Monitoring only." },
    notes: [
      [396, "review", "Marcus Adeyemi", "Enrolment. Curious about prevention, no family history."],
      [298, "review", "Marcus Adeyemi", "Paused membership — travelling for work. Re-engage later."],
    ],
    vitals: [[396, 58.8, 112, 70], [300, 59.1, 114, 71]],
  },
];

async function main() {
  console.log("Applying schema (additive)…");
  await sql.unsafe(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));

  for (const entry of members) {
    // Everything but the Lithos link is safe to refresh; the link is preserved.
    const { lithos_patient_id: _p, lithos_linked_at: _l, ...refresh } = entry.member;
    await sql`
      INSERT INTO members ${sql(entry.member)}
      ON CONFLICT (id) DO UPDATE SET ${sql({ ...refresh, updated_at: new Date() })}`;

    for (const panel of entry.panels) {
      await sql`INSERT INTO lab_panels ${sql(panel)} ON CONFLICT (id) DO NOTHING`;
    }
    await sql`INSERT INTO member_targets ${sql({
      id: `tgt_${entry.member.id.replace("eu_mem_", "")}`,
      member_id: entry.member.id,
      ldl_c_target: entry.target.ldl,
      apo_b_target: entry.target.apoB,
      rationale: entry.target.rationale,
      set_at: day(30).toISOString(),
    })} ON CONFLICT (id) DO NOTHING`;

    let n = 0;
    for (const [daysAgo, focus, author, summary] of entry.notes) {
      await sql`INSERT INTO coach_notes ${sql({
        id: `note_${entry.member.id.replace("eu_mem_", "")}_${++n}`,
        member_id: entry.member.id, author, focus,
        occurred_at: day(daysAgo).toISOString(), summary,
      })} ON CONFLICT (id) DO NOTHING`;
    }
    let m = 0;
    for (const med of entry.meds ?? []) {
      await sql`INSERT INTO member_medications ${sql({
        id: `med_${entry.member.id.replace("eu_mem_", "")}_${++m}`,
        member_id: entry.member.id,
        name: med.name,
        kind: med.kind ?? "other",
        started_on: med.startedDaysAgo ? iso(day(med.startedDaysAgo)) : null,
        stopped_on: med.stoppedDaysAgo ? iso(day(med.stoppedDaysAgo)) : null,
        notes: med.notes ?? null,
      })} ON CONFLICT (id) DO NOTHING`;
    }

    let v = 0;
    for (const [daysAgo, weight, systolic, diastolic] of entry.vitals) {
      await sql`INSERT INTO vitals ${sql({
        id: `vit_${entry.member.id.replace("eu_mem_", "")}_${++v}`,
        member_id: entry.member.id,
        recorded_at: day(daysAgo).toISOString(),
        weight_kg: weight, systolic, diastolic, resting_hr: null,
      })} ON CONFLICT (id) DO NOTHING`;
    }
  }

  const rows = await sql`
    SELECT m.id, m.first_name || ' ' || m.last_name AS name, m.status, m.lithos_patient_id,
           t.ldl_c_target AS target,
           (SELECT ldl_c FROM lab_panels p WHERE p.member_id = m.id ORDER BY drawn_on DESC LIMIT 1) AS latest_ldl
    FROM members m LEFT JOIN member_targets t ON t.member_id = m.id
    ORDER BY m.last_name`;
  console.log(`\nSeeded/refreshed ${rows.length} members.\n`);
  for (const r of rows) {
    const gap = r.latest_ldl && r.target ? Number(r.latest_ldl) - Number(r.target) : null;
    console.log(
      `  ${r.name.padEnd(18)} ${String(r.status).padEnd(8)} LDL ${String(r.latest_ldl).padStart(5)} ` +
      `target ${String(r.target).padStart(5)}` +
      (gap !== null ? `  ${gap > 0 ? `${gap.toFixed(0)} above` : "at goal"}` : "").padEnd(12) +
      (r.lithos_patient_id ? `  → ${r.lithos_patient_id}` : ""));
  }
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
