/**
 * The ILLUSTRATIVE intake, for any program this starter has no real intake
 * written for yet. A few general questions most telehealth intakes ask —
 * what the patient wants help with, what they take, what they react to, and
 * a short health screen — so the journey runs end to end for every protocol
 * an organization chose.
 *
 * These are NOT the protocol's real questions. Lithos holds the real intake
 * schema per program (the Intake Schemas guide in the API reference); a
 * program whose schema is still a placeholder accepts this shape, and one with
 * a real schema answers `intake_form.schema_invalid` naming the fields it
 * wants. Replace this with the program's own intake before going live.
 *
 * Client-safe: no server imports.
 */

export const GENERIC_SCREENING = [
  ["pregnant_or_breastfeeding", "I'm pregnant, breastfeeding, or planning a pregnancy"],
  ["serious_drug_reaction", "I've had a serious allergic reaction to a medicine"],
  ["kidney_or_liver_disease", "I have kidney or liver disease"],
  ["recent_hospital_stay", "I've stayed in a hospital in the past 12 months"],
] as const;

export type GenericIntake = {
  reason_for_visit: string;
  current_medications: string;
  allergies: string;
} & Record<(typeof GENERIC_SCREENING)[number][0], boolean>;

type FieldError = { pointer: string; message: string };

const MAX = 2000;

export function parseGenericIntake(
  text: (name: string) => string,
  checked: (name: string) => boolean,
): { ok: true; value: GenericIntake } | { ok: false; errors: FieldError[] } {
  const reason = text("reason_for_visit");
  const errors: FieldError[] = [];
  if (!reason) errors.push({ pointer: "/intake_form/data/reason_for_visit", message: "Tell us what you'd like help with." });
  for (const name of ["reason_for_visit", "current_medications", "allergies"]) {
    if (text(name).length > MAX) errors.push({ pointer: `/intake_form/data/${name}`, message: `Keep this under ${MAX} characters.` });
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      reason_for_visit: reason,
      current_medications: text("current_medications") || "None",
      allergies: text("allergies") || "None known",
      ...(Object.fromEntries(GENERIC_SCREENING.map(([name]) => [name, checked(name)])) as Record<(typeof GENERIC_SCREENING)[number][0], boolean>),
    },
  };
}
