/**
 * An intake read back the way a reviewer takes it in: the facts that decide
 * the case, and every screening question the patient answered "yes" to.
 *
 * Used by the setup page's illustrative review card. It works only from the
 * intake data the partner sent (as the API returns it) — it isn't Lithos's
 * clinician screen, and it applies no clinical rules: flagging a "yes" is
 * showing the answer, not judging it.
 *
 * Client-safe: no server imports.
 */

import { intakeKey, type ProgramKey } from "../setup/programs";
import { FH_STATUS, LIPID_INDICATIONS, LIPID_SCREENING } from "./lipid";
import { WEIGHT_COMORBIDITIES, WEIGHT_SCREENING_HEALTH, WEIGHT_SCREENING_ORGANS } from "./weight";
import { GENERIC_SCREENING } from "./generic";
import { ACNE_SCREENING_HEALTH, ACNE_SCREENING_SKIN, HP_SCREENING_HEALTH, HP_SCREENING_RECENT } from "./derm";
import { EYELASH_SCREENING_EYES, EYELASH_SCREENING_HEALTH, EYELASH_SCREENING_LIDS } from "./eyelash";
import { ED_HISTORY, ED_SCREENING_HEALTH, ED_SCREENING_HEART, ED_SCREENING_MEDICINES } from "./ed";
import {
  HAIR_FERTILITY, HAIR_SCREENING_HEALTH, HAIR_SCREENING_MEDICINES, HAIR_SCREENING_MOOD, HAIR_SCREENING_SIGNS,
} from "./hair-loss";
import { HSV_SCREENING_EPISODE, HSV_SCREENING_HEALTH, HSV_SCREENING_MEDICINES, HSV_SCREENING_URGENT } from "./hsv";
import {
  B12_SCREENING_ABSORPTION, B12_SCREENING_HEALTH, GLUTATHIONE_SCREENING, NAD_SCREENING, OXYTOCIN_SCREENING_HEALTH,
  OXYTOCIN_SCREENING_MENTAL, OXYTOCIN_SUICIDE_SCREEN, SERMORELIN_SCREENING,
} from "./wellness";

export type IntakeReview = {
  facts: Array<{ label: string; value: string }>;
  /** Screening questions answered "yes", in the patient's words. */
  flags: string[];
};

type Data = Record<string, unknown>;

const yesTo = (data: Data, items: readonly (readonly [string, string])[]) =>
  items.filter(([name]) => data[name] === true).map(([, label]) => label);

function lipid(data: Data): IntakeReview {
  return {
    facts: [
      { label: "Reason", value: LIPID_INDICATIONS[String(data.indication)] ?? String(data.indication ?? "—") },
      { label: "LDL-C", value: data.ldl_c ? `${data.ldl_c} mg/dL${data.ldl_c_date ? `, measured ${data.ldl_c_date}` : ""}` : "—" },
      { label: "Familial hypercholesterolemia", value: FH_STATUS[String(data.familial_hypercholesterolemia)] ?? "—" },
    ],
    flags: yesTo(data, LIPID_SCREENING),
  };
}

function weight(data: Data): IntakeReview {
  const cm = Number(data.height_cm);
  const kg = Number(data.weight_kg);
  const inches = Math.round(cm / 2.54);
  const bmi = cm > 0 && kg > 0 ? (kg / (cm / 100) ** 2).toFixed(1) : null;
  const comorbidities = Array.isArray(data.comorbidities)
    ? data.comorbidities.map((key) => WEIGHT_COMORBIDITIES.find(([k]) => k === key)?.[1] ?? String(key))
    : [];
  return {
    facts: [
      { label: "Height", value: cm ? `${cm} cm (${Math.floor(inches / 12)} ft ${inches % 12} in)` : "—" },
      { label: "Weight", value: kg ? `${kg} kg (${Math.round(kg / 0.45359237)} lbs)` : "—" },
      { label: "BMI", value: bmi ?? "—" },
      { label: "On a GLP-1 now", value: data.already_on_glp1 === true ? "Yes" : data.already_on_glp1 === false ? "No" : "Not asked" },
      { label: "Weight-related conditions", value: comorbidities.length > 0 ? comorbidities.join(", ") : "None" },
    ],
    flags: yesTo(data, [...WEIGHT_SCREENING_ORGANS, ...WEIGHT_SCREENING_HEALTH]),
  };
}

function generic(data: Data): IntakeReview {
  const text = (name: string) => (typeof data[name] === "string" && data[name] ? String(data[name]) : "—");
  return {
    facts: [
      { label: "Wants help with", value: text("reason_for_visit") },
      { label: "Takes now", value: text("current_medications") },
      { label: "Allergies", value: text("allergies") },
    ],
    flags: yesTo(data, GENERIC_SCREENING),
  };
}

function derm(data: Data, screening: readonly (readonly [string, string])[]): IntakeReview {
  const list = (name: string) => (Array.isArray(data[name]) ? (data[name] as unknown[]).join(", ") : "—");
  return {
    facts: [
      { label: "Areas", value: list("affected_areas") },
      { label: "Duration", value: String(data.condition_duration ?? "—").replaceAll("_", " ") },
    ],
    flags: yesTo(data, screening),
  };
}

function eyelash(data: Data): IntakeReview {
  const text = (name: string) => String(data[name] ?? "—").replaceAll("_", " ");
  const list = (name: string) => (Array.isArray(data[name]) && data[name].length ? (data[name] as unknown[]).join(", ") : "None");
  return {
    facts: [
      { label: "Wants lashes", value: list("treatment_goals") },
      { label: "Short or sparse for", value: text("condition_duration") },
      { label: "Came on", value: text("lash_loss_onset") },
      { label: "Eyes", value: text("eyes_affected") },
      { label: "Eye color", value: text("eye_color") },
      { label: "Chemotherapy, ever", value: data.chemotherapy_history === true ? `Yes, last dose ${text("chemotherapy_last_dose_on")}` : "No" },
      { label: "Lash extensions, lift or tinting", value: list("lash_cosmetic_services") },
    ],
    flags: yesTo(data, [...EYELASH_SCREENING_LIDS, ...EYELASH_SCREENING_EYES, ...EYELASH_SCREENING_HEALTH]),
  };
}

function wellness(data: Data, facts: IntakeReview["facts"], screening: readonly (readonly [string, string])[]): IntakeReview {
  const cancer = data.cancer_treatment_last_3_years === true
    ? [{ label: "Cancer treatment, last 3 years", value: data.oncologist_approval === true ? "Yes, oncologist approved" : "Yes, not approved" }]
    : [];
  const injects = "can_self_administer" in data
    ? [{ label: "Can give the injections", value: data.can_self_administer === true ? "Yes" : "No" }]
    : [];
  return { facts: [...facts, ...cancer, ...injects], flags: yesTo(data, screening) };
}

const listOf = (data: Data, name: string) =>
  Array.isArray(data[name]) && data[name].length ? (data[name] as unknown[]).map((v) => String(v).replaceAll("_", " ")).join(", ") : "None";

function ed(data: Data): IntakeReview {
  const text = (name: string) => String(data[name] ?? "—").replaceAll("_", " ");
  const list = (name: string) => (Array.isArray(data[name]) && data[name].length ? (data[name] as unknown[]).join(", ").replaceAll("_", " ") : "None");
  return {
    facts: [
      { label: "Goals", value: list("treatment_goals") },
      { label: "For", value: `${text("condition_duration")}, came on ${text("ed_onset")}` },
      { label: "Blood pressure", value: `${data.blood_pressure_systolic ?? "—"}/${data.blood_pressure_diastolic ?? "—"} on ${text("blood_pressure_measured_on")} (${text("blood_pressure_setting")})` },
      { label: "Two flights of stairs", value: text("climbs_two_flights") },
      { label: "Risk factors", value: list("cardiovascular_risk_factors") },
      { label: "Heavy drinking days, past year", value: String(data.heavy_drinking_days_past_year ?? "—") },
    ],
    flags: yesTo(data, [...ED_SCREENING_HEART, ...ED_SCREENING_MEDICINES, ...ED_SCREENING_HEALTH, ...ED_HISTORY]),
  };
}

function hairLoss(data: Data): IntakeReview {
  const text = (name: string) => String(data[name] ?? "—").replaceAll("_", " ");
  const list = (name: string) => (Array.isArray(data[name]) && data[name].length ? (data[name] as unknown[]).join(", ").replaceAll("_", " ") : "None");
  return {
    facts: [
      { label: "Goals", value: list("treatment_goals") },
      { label: "Where", value: list("thinning_areas") },
      { label: "For", value: `${text("condition_duration")}, ${text("thinning_pace")}, ${text("shedding_or_thinning")}` },
      { label: "Family history", value: data.family_history === true ? "Yes" : "No" },
      { label: "Could become pregnant", value: data.can_become_pregnant === true ? `Yes, ${data.reliable_contraception === true ? "with" : "without"} reliable contraception` : "No" },
      { label: "Finasteride side effects understood", value: data.finasteride_risks_attested === true ? "Yes" : "No" },
    ],
    flags: yesTo(data, [...HAIR_SCREENING_SIGNS, ...HAIR_SCREENING_MOOD, ...HAIR_FERTILITY, ...HAIR_SCREENING_MEDICINES, ...HAIR_SCREENING_HEALTH]),
  };
}

function hsv(data: Data): IntakeReview {
  const text = (name: string) => String(data[name] ?? "—").replaceAll("_", " ");
  return {
    facts: [
      { label: "Wants", value: text("requested_treatment") },
      { label: "Diagnosed by", value: `${text("prior_diagnosis_method")}${data.prior_diagnosis_details ? `: ${String(data.prior_diagnosis_details)}` : ""}` },
      ...(data.sores_onset ? [{ label: "This outbreak", value: `${text("sores_onset")}. ${String(data.episode_description ?? "")}` }] : []),
      { label: "Outbreaks, last 12 months", value: `${text("outbreaks_last_12_months")}, ${text("outbreak_impact")} impact` },
      ...(Array.isArray(data.suppression_goals) ? [{ label: "Suppression goals", value: (data.suppression_goals as unknown[]).join(", ").replaceAll("_", " ") }] : []),
    ],
    flags: yesTo(data, [
      ...HSV_SCREENING_EPISODE, ...HSV_SCREENING_URGENT, ...HSV_SCREENING_HEALTH, ...HSV_SCREENING_MEDICINES,
      ["prior_diagnosis_unclear", "Doesn't remember exactly who diagnosed it or when"],
      ["new_sexual_exposure_or_sti_symptoms", "New sexual partner or exposure, or other STI symptoms"],
    ]),
  };
}

export function reviewIntake(program: ProgramKey, data: Data): IntakeReview {
  switch (intakeKey(program)) {
    case "weight_management": return weight(data);
    case "lipid_management": return lipid(data);
    case "acne": return derm(data, [...ACNE_SCREENING_SKIN, ...ACNE_SCREENING_HEALTH]);
    case "hyperpigmentation_photoaging": return derm(data, [...HP_SCREENING_RECENT, ...HP_SCREENING_HEALTH]);
    case "eyelash_growth": return eyelash(data);
    case "erectile_dysfunction": return ed(data);
    case "hair_loss": return hairLoss(data);
    case "herpes_simplex": return hsv(data);
    case "nad_plus":
      return wellness(data, [
        { label: "Goals", value: listOf(data, "treatment_goals") },
        ...(data.kidney_disease === true ? [{ label: "Nephrologist approved", value: data.nephrologist_approval === true ? "Yes" : "No" }] : []),
      ], NAD_SCREENING);
    case "glutathione":
      return wellness(data, [{ label: "Goals", value: listOf(data, "treatment_goals") }], GLUTATHIONE_SCREENING);
    case "sermorelin":
      return wellness(data, [
        { label: "Goals", value: listOf(data, "treatment_goals") },
        { label: "Height · weight", value: `${data.height_cm ?? "—"} cm · ${data.weight_kg ?? "—"} kg` },
        { label: "Interacting medicines", value: listOf(data, "interacting_medications") },
      ], SERMORELIN_SCREENING);
    case "vitamin_b12":
      return wellness(data, [
        { label: "Symptoms", value: listOf(data, "treatment_goals") },
        { label: "For", value: String(data.condition_duration ?? "—").replaceAll("_", " ") },
      ], [...B12_SCREENING_ABSORPTION, ...B12_SCREENING_HEALTH]);
    case "oxytocin":
      return wellness(data, [
        { label: "Concerns", value: listOf(data, "treatment_goals") },
        { label: "Sleep disorders", value: listOf(data, "sleep_disorders") },
        { label: "Mental health history", value: String(data.psychiatric_history ?? "—") },
      ], [...OXYTOCIN_SUICIDE_SCREEN, ...OXYTOCIN_SCREENING_MENTAL, ...OXYTOCIN_SCREENING_HEALTH]);
    default: return generic(data);
  }
}
