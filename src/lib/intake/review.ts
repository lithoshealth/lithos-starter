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

import type { ProgramKey } from "../setup/programs";
import { FH_STATUS, LIPID_INDICATIONS, LIPID_SCREENING } from "./lipid";
import { WEIGHT_COMORBIDITIES, WEIGHT_SCREENING_HEALTH, WEIGHT_SCREENING_ORGANS } from "./weight";
import { GENERIC_SCREENING } from "./generic";
import { ACNE_SCREENING_HEALTH, ACNE_SCREENING_SKIN, HP_SCREENING_HEALTH, HP_SCREENING_RECENT } from "./derm";

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

export function reviewIntake(program: ProgramKey, data: Data): IntakeReview {
  switch (program) {
    case "weight_management": return weight(data);
    case "lipid_management": return lipid(data);
    case "acne": return derm(data, [...ACNE_SCREENING_SKIN, ...ACNE_SCREENING_HEALTH]);
    case "hyperpigmentation_photoaging": return derm(data, [...HP_SCREENING_RECENT, ...HP_SCREENING_HEALTH]);
    default: return generic(data);
  }
}
