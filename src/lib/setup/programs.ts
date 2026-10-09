/**
 * The programs this app can offer.
 *
 * Lithos organizes care into programs — lipid management, weight management,
 * and more as they're added — each with its own protocol, intake form and
 * treatments. An organization is provisioned for some of them, and the
 * program a partner picks decides what it asks patients and what a clinician
 * can prescribe. That choice is worth making on purpose, so it's its own step.
 *
 * `key` is the Lithos care-plan category. The picker offers every category in
 * the organization's formulary (`GET /v1/catalog_treatments`), so the app
 * follows whatever protocols the organization chose. Two have their real
 * intake written out here; any other gets an ILLUSTRATIVE intake — a few
 * general questions, labelled as such — so the whole journey still runs. The
 * chosen program is saved to starter.config.json, and the site's copy
 * (src/lib/programs/content.ts) and care-review intake follow it.
 *
 * Client-safe: no server imports.
 */

/** A Lithos care-plan category, e.g. `lipid_management`. */
export type ProgramKey = string;

export type Program = {
  key: ProgramKey;
  label: string;
  /** Walkable in this starter today. */
  supported: boolean;
  /** What the intake for this program asks, in plain words. */
  asks: string;
  /** No real intake for this program here yet: the app asks a general, illustrative set of questions. */
  illustrative?: boolean;
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

/** What a category slug looks like — anything else is refused before it reaches a URL or the config file. */
const CATEGORY = /^[a-z][a-z0-9_]{0,63}$/;

export function isProgramKey(value: unknown): value is ProgramKey {
  return typeof value === "string" && CATEGORY.test(value);
}

/** "sexual_health" → "Sexual health" — how Lithos itself labels a category. */
export function categoryLabel(key: ProgramKey): string {
  const words = key.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The program for a category: the written-out one if there is one, else an illustrative one. */
export function programFor(key: string | undefined): Program | undefined {
  if (!isProgramKey(key)) return undefined;
  return PROGRAMS.find((p) => p.key === key) ?? {
    key,
    label: categoryLabel(key),
    supported: true,
    illustrative: true,
    asks: "an illustrative set of general questions — what they want help with, medicines, allergies and a short health screen — not this protocol's real intake",
  };
}

/** What the picker shows for each program, given this organization's formulary. */
export type ProgramOption = Program & { treatments: string[]; inFormulary: boolean; selectable: boolean };
