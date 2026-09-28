/**
 * The programs the walkthrough knows about.
 *
 * Lithos organizes care into programs — lipid management, weight management —
 * each with its own protocol, intake form and treatments. An organization is
 * provisioned for some of them, and the program a partner picks decides what it
 * asks patients and what a clinician can prescribe. That choice is worth making
 * on purpose, so it's its own step.
 *
 * `key` is the Lithos care-plan category. Both are walked end to end: the
 * chosen program is saved to starter.config.json, and the site's copy
 * (src/lib/programs/content.ts) and care-review intake follow it.
 *
 * Client-safe: no server imports.
 */

export type ProgramKey = "lipid_management" | "weight_management";

export type Program = {
  key: ProgramKey;
  label: string;
  /** Walkable in this starter today. */
  supported: boolean;
  /** What the intake for this program asks, in plain words. */
  asks: string;
};

export const PROGRAMS: Program[] = [
  {
    key: "lipid_management",
    label: "Lipid management",
    supported: true,
    asks: "the patient's LDL-C and when it was drawn, familial hypercholesterolemia status, and eight screening questions",
  },
  {
    key: "weight_management",
    label: "Weight loss",
    supported: true,
    asks: "height and weight, whether they already take a GLP-1, seventeen screening questions and any weight-related conditions",
  },
];

export function programFor(key: string | undefined): Program | undefined {
  return PROGRAMS.find((p) => p.key === key);
}

/** What the picker shows for each program, given this organization's formulary. */
export type ProgramOption = Program & { treatments: string[]; inFormulary: boolean; selectable: boolean };
