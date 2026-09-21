import type { MemberRecord } from "./members";
import type { LipidManagementInitialIntake, PatientCreate } from "./lithos/types";

/**
 * Escalating a member to medical care: building the intake for a member who
 * already exists in the partner's own records.
 *
 * ILLUSTRATIVE, NOT CLINICAL POLICY. The eligibility rules below are an example
 * of the kind of screening a partner applies before creating an encounter,
 * written against a draft of the lipid management protocol. They are not
 * Lithos's authoritative criteria. Get the current protocol for your programs
 * from your Lithos contact before relying on any rule here.
 *
 * Two things this module shows a partner how to do:
 *
 *   1. Screen before creating anything. The API validates the *shape* of an
 *      intake; clinical eligibility is judged at review. Screening out members
 *      a protocol excludes saves the patient a wasted request and the clinician
 *      a wasted review.
 *   2. Send what you know. The lipid intake declares `ldl_c`; other values you
 *      hold (ApoB, Lp(a), prior results) can travel as additional keys, which
 *      the reviewer sees.
 *
 * It builds the payload and reports, per value, whether it's carried as a
 * declared field, as an additional key, or not held at all.
 */

export type CarriedField = { field: string; value: string; from: string };
export type Ask = { kind: "question" | "attestation" | "lab"; what: string; why: string };
export type HardStop = { rule: string; triggered: boolean; basis: string };

type ScreeningKey =
  | "established_atherosclerotic_cardiovascular_disease" | "recent_cardiac_condition"
  | "drug_hypersensitivity" | "cirrhosis" | "severe_hepatic_impairment"
  | "severe_renal_impairment" | "pregnancy" | "currently_taking_cyclosporine";

/** Declared intake fields we can fill, plus the protocol's panel as undeclared extras. */
export type IntakeDraft = Omit<LipidManagementInitialIntake, ScreeningKey> & Record<string, unknown>;

export type EscalationPlan = {
  patient: Omit<PatientCreate, "telehealth_consented_at" | "identity_verified_at">;
  intake: IntakeDraft;
  /** Declared by the contract — Lithos validates these. */
  carried: CarriedField[];
  /** Sent as undeclared keys — stored and shown to the reviewer, validated by nobody, labelled by humanising the key. */
  sentUndeclared: CarriedField[];
  /** Required before an encounter may be created, and not held by a coaching business. */
  mustAsk: Ask[];
  /** Protocol / platform hard stops the partner must enforce. Any `triggered` means: do not create the encounter. */
  hardStops: HardStop[];
  /** Things the protocol says to flag to the MD rather than stop on. */
  flags: string[];
  eligible: boolean;
};

const num = (value: string | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

/**
 * `date` columns come back from the driver as Date objects. Lithos wants a plain
 * calendar date, and toISOString() would shift the day for anyone west of UTC —
 * a lab drawn on the 28th arriving as the 29th. Read the local date parts.
 */
function isoDate(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ageOn(dob: string | Date, on = new Date()): number {
  const birth = typeof dob === "string" ? new Date(dob) : dob;
  let age = on.getFullYear() - birth.getFullYear();
  const beforeBirthday = on.getMonth() < birth.getMonth() ||
    (on.getMonth() === birth.getMonth() && on.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function buildEscalationPlan(record: MemberRecord): EscalationPlan {
  const { member, panels, target, notes, medications } = record;
  const latest = panels[0];
  if (!latest) throw new Error(`Member ${member.id} has no lab panel to escalate with`);
  const ldl = num(latest.ldl_c);
  if (ldl === null) throw new Error(`Member ${member.id}'s latest panel has no LDL-C`);

  const carried: CarriedField[] = [];
  const sentUndeclared: CarriedField[] = [];
  const mustAsk: Ask[] = [];
  const hardStops: HardStop[] = [];
  const flags: string[] = [];
  const drawnOn = isoDate(latest.drawn_on);
  const hasBaselineMarkers = panels.some((p) => p.apo_b !== null || p.lp_a !== null);

  // ---- declared fields -------------------------------------------------------

  carried.push({ field: "ldl_c", value: `${ldl} mg/dL`, from: `panel drawn ${drawnOn}` });
  carried.push({ field: "ldl_c_date", value: drawnOn, from: "same panel" });

  // Coaching holds no structured FH status; it lives in prose. Inferred from the
  // clinical summary and notes, and said so — a reviewer should confirm it.
  const clinicalText = `${target?.rationale ?? ""} ${notes.map((n) => n.summary).join(" ")}`.toLowerCase();
  const familial: LipidManagementInitialIntake["familial_hypercholesterolemia"] =
    /hofh|homozygous/.test(clinicalText) ? "homozygous"
      : /hefh|heterozygous/.test(clinicalText) ? "heterozygous"
        : "none";
  carried.push({
    field: "familial_hypercholesterolemia", value: familial,
    from: familial === "none" ? "assumed — nothing on record" : "inferred from clinical summary; confirm",
  });

  // Medications, from the structured record rather than scraped out of coach
  // notes. List current medications — a clinician reading a nine-month-old
  // LDL-C needs to know the patient was on a statin when it was drawn, and that
  // is what makes a stale lab a judgement call rather than a blocker.
  const active = medications.filter((m) => m.stopped_on === null);
  const stopped = medications.filter((m) => m.stopped_on !== null);
  const describe = (m: (typeof medications)[number]) =>
    [m.name, m.started_on ? `since ${isoDate(m.started_on)}` : null, m.stopped_on ? `stopped ${isoDate(m.stopped_on)}` : null, m.notes]
      .filter(Boolean).join(" — ");

  const currentLipidMedications = [
    ...active.filter((m) => m.kind === "lipid_lowering").map(describe),
    ...stopped.filter((m) => m.kind === "lipid_lowering").map((m) => `PRIOR: ${describe(m)}`),
  ];
  const medicationsAllergies = [
    ...active.filter((m) => m.kind === "other").map(describe),
    ...medications.filter((m) => m.kind === "allergy").map((m) => `ALLERGY: ${m.name}`),
  ];
  if (currentLipidMedications.length > 0) {
    carried.push({
      field: "current_lipid_medications",
      value: `${currentLipidMedications.length} entr${currentLipidMedications.length === 1 ? "y" : "ies"}`,
      from: "medication record (structured)",
    });
  }
  if (medicationsAllergies.length > 0) {
    carried.push({ field: "medications_allergies", value: `${medicationsAllergies.length} entries`, from: "medication record (structured)" });
  }

  // A lipid medication stopped with a muscle-symptom note is statin
  // intolerance; coach notes are the fallback for members recorded before the
  // medication table existed.
  const statinIntolerance =
    stopped.some((m) => m.kind === "lipid_lowering" && /myalgia|intoleran|ach|pain/i.test(`${m.notes ?? ""}`)) ||
    /myalgia|intoleran|stopped the statin|calf ach/i.test(clinicalText);
  if (statinIntolerance) {
    carried.push({ field: "statin_intolerance", value: "true", from: stopped.length > 0 ? "medication record" : "inferred from coach notes" });
  }

  // Lab recency. The protocol wants results from within 12 months, and leaves a
  // stale lab to provider judgement so long as medications are listed — so say
  // both, in the one place a reviewer will read.
  const ageDays = Math.round((Date.now() - new Date(drawnOn).getTime()) / 86_400_000);
  const staleNote = ageDays > 180
    ? `LDL-C is ${Math.round(ageDays / 30)} months old${active.some((m) => m.kind === "lipid_lowering") ? `, drawn while on ${active.filter((m) => m.kind === "lipid_lowering").map((m) => m.name).join(" + ")}` : ""}`
    : null;
  if (staleNote) flags.push(`${staleNote} — recency is provider judgement; medications are listed`);
  if (ageDays > 365) {
    mustAsk.push({ kind: "lab", what: "A current LDL-C", why: `The only result on file is ${Math.round(ageDays / 30)} months old; the protocol wants results from within 12 months.` });
  }

  // ---- the protocol's panel, sent as undeclared extras -----------------------

  const extras: Record<string, unknown> = {};
  const panelFields: Array<[keyof typeof latest, string, string]> = [
    ["apo_b", "apo_b", "mg/dL"], ["lp_a", "lp_a", "nmol/L"], ["a1c", "hba1c", "%"],
    ["hdl_c", "hdl_c", "mg/dL"], ["triglycerides", "triglycerides", "mg/dL"],
    ["total_cholesterol", "total_cholesterol", "mg/dL"], ["hs_crp", "hs_crp", "mg/L"],
  ];
  for (const [column, key, unit] of panelFields) {
    const value = num(latest[column] as string | null);
    if (value === null) continue;
    extras[key] = value;
    sentUndeclared.push({ field: key, value: `${value} ${unit}`, from: `panel drawn ${drawnOn} — reviewer sees "${key.replace(/_/g, " ")}: ${value}", no unit` });
  }

  if (panels.length > 1) {
    extras.prior_results = panels.slice(1).map((p) => ({
      drawn_on: isoDate(p.drawn_on), ldl_c: num(p.ldl_c), apo_b: num(p.apo_b),
    }));
    const oldest = panels[panels.length - 1];
    sentUndeclared.push({
      field: "prior_results", value: `${panels.length - 1} earlier panels (LDL ${num(oldest.ldl_c)} → ${ldl})`,
      from: "renders as an array's to_s — visible, not readable",
    });
  }

  const months = Math.round((Date.now() - new Date(member.joined_at).getTime()) / (30 * 86_400_000));
  const tenure = months >= 1 ? `${months} month${months === 1 ? "" : "s"}` : `${Math.max(1, Math.round((Date.now() - new Date(member.joined_at).getTime()) / 86_400_000))} days`;
  extras.partner_context = [
    notes.length > 1
      ? `${tenure} of Eucardia coaching with ${member.coach_name ?? "a coach"}`
      : `Eucardia member ${tenure}; no coaching history yet`,
    staleNote,
    statinIntolerance ? "prior statin stopped for muscle symptoms" : null,
    !hasBaselineMarkers ? "no baseline ApoB or Lp(a) on file" : null,
    target?.ldl_c_target ? `Eucardia's own target LDL-C ${num(target.ldl_c_target)} mg/dL (Lithos protocol target is < 50)` : null,
  ].filter(Boolean).join("; ");
  sentUndeclared.push({ field: "partner_context", value: "one line of free text", from: "the only way to say lifestyle was already tried" });

  // ---- protocol-required labs Eucardia doesn't hold --------------------------

  // Not a blocker: the clinician can order baseline markers at sign-off. It's a
  // note about what the recheck will have to compare against.
  if (!hasBaselineMarkers) {
    flags.push("No baseline ApoB or Lp(a) — LDL-C only. Waived at initiation in practice; the ~3-month recheck will have nothing to compare a new ApoB against.");
  }
  if (latest.a1c === null) {
    mustAsk.push({ kind: "lab", what: "HbA1c", why: "On the protocol's initial panel; not on Eucardia's latest panel." });
  }
  mustAsk.push({ kind: "lab", what: "CMP (if the member chooses a statin)", why: "Required on the statin path; Eucardia's panel has no liver or renal values." });
  mustAsk.push({
    kind: "attestation", what: "Lab document upload (lab_report_upload_id)",
    why: "Documented labs within 12 months → 3-month prescription; without the document the protocol treats this as attestation-only → 1 month. Eucardia drew the lab and still can't prove it structurally.",
  });

  // ---- what only the member can answer ---------------------------------------

  mustAsk.push({ kind: "attestation", what: "Telehealth consent + identity verification", why: "Required timestamps. Membership signup consent is not telehealth consent." });
  mustAsk.push({
    kind: "question", what: "Screening: recent cardiac condition, drug hypersensitivity, cirrhosis, hepatic/renal impairment, pregnancy, cyclosporine",
    why: "Required, and hard stops if yes. A coaching record never needed them — and the medical director wants them asked at every encounter anyway.",
  });

  // ---- hard stops the partner must enforce -----------------------------------

  const age = ageOn(member.date_of_birth);
  hardStops.push({ rule: "Age 18–64 (platform)", triggered: age < 18 || age > 64, basis: `age ${age}` });
  // Unrecorded is a stop, not a pass. A required boolean you never asked about
  // must not default to whichever value lets the request through — ask it, store
  // the answer, and only then send it.
  if (member.enrolled_in_government_insurance === null) {
    mustAsk.push({
      kind: "question", what: "Medicare / Medicaid / Tricare enrollment",
      why: "A platform hard stop for every partner, and absent from the API contract — a membership business has no other reason to hold it.",
    });
  }
  hardStops.push({
    rule: "Not on Medicare / Medicaid / Tricare (platform)", triggered: member.enrolled_in_government_insurance !== false,
    basis: member.enrolled_in_government_insurance === null ? "not recorded — must ask" : member.enrolled_in_government_insurance ? "enrolled" : "not enrolled",
  });
  hardStops.push({ rule: "LDL-C ≥ 50 mg/dL", triggered: ldl < 50, basis: `latest LDL-C ${ldl}` });
  hardStops.push({ rule: "Not homozygous FH", triggered: familial === "homozygous", basis: `FH status ${familial}` });

  // ASCVD read from the clinical summary only — coach notes mention family
  // history ("father MI at 61") that would false-positive.
  const ascvd = /ascvd|stent|revasculari|\bmi\b|cabg|stroke|\btia\b/i.test(target?.rationale ?? "");
  if (familial === "heterozygous") {
    hardStops.push({ rule: "HeFH: LDL-C < 400", triggered: ldl >= 400, basis: `LDL-C ${ldl}` });
    hardStops.push({ rule: "HeFH: no established ASCVD", triggered: ascvd, basis: ascvd ? "ASCVD in clinical summary" : "none recorded" });
    if (ldl >= 330 && ldl < 400) flags.push(`HeFH with LDL-C ${ldl} (330–399): yellow flag to the MD`);
    flags.push("HeFH: reviewer must assess responsiveness at recheck; refer out if non-responsive");
  } else if (ascvd) {
    flags.push("Established ASCVD in clinical summary — send as established_atherosclerotic_cardiovascular_disease: true");
  }

  const eligible = hardStops.every((h) => !h.triggered);

  return {
    patient: {
      external_id: member.id, // Eucardia's own id — Lithos stores it immutably for reconciliation
      first_name: member.first_name,
      last_name: member.last_name,
      date_of_birth: isoDate(member.date_of_birth),
      sex: member.sex,
      address: {
        line1: member.address_line1 ?? "", line2: member.address_line2,
        city: member.city ?? "", state: member.state ?? "", postal_code: member.postal_code ?? "",
      },
      email: member.email,
      phone: member.phone ?? "",
      // Safe to assert: an unrecorded answer is a hard stop above, so an
      // escalation that reaches the API has been answered explicitly.
      enrolled_in_government_insurance: member.enrolled_in_government_insurance === true,
    },
    intake: {
      indication: "hypercholesterolemia",
      ldl_c: ldl,
      ldl_c_date: drawnOn,
      familial_hypercholesterolemia: familial,
      ...(currentLipidMedications.length > 0 ? { current_lipid_medications: currentLipidMedications } : {}),
      ...(medicationsAllergies.length > 0 ? { medications_allergies: medicationsAllergies } : {}),
      ...(statinIntolerance ? { statin_intolerance: true } : {}),
      ...extras,
    },
    carried,
    sentUndeclared,
    mustAsk,
    hardStops,
    flags,
    eligible,
  };
}
