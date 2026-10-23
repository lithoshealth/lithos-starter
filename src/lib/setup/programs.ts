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
 * follows whatever protocols the organization chose. The ones below have
 * their real intake written out here; any other gets an ILLUSTRATIVE intake — a few
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
    key: "lipid_pcsk9",
    label: "Lipid management, PCSK9 inhibitors",
    supported: true,
    asks: "the lipid intake (LDL-C, familial hypercholesterolemia status and eight screening questions), and a recent lipid panel before the clinician reviews it",
  },
  {
    key: "weight_management",
    label: "Weight loss",
    supported: true,
    asks: "height and weight, whether they already take a GLP-1, seventeen screening questions and any weight-related conditions",
  },
  {
    key: "acne",
    label: "Acne",
    supported: true,
    asks: "where the acne is and what it looks like, past treatments, a health screen, and three photos of the face (plus the chest or back if affected)",
  },
  {
    key: "hyperpigmentation_photoaging",
    label: "Hyperpigmentation & Photoaging",
    supported: true,
    asks: "what the patient wants treated, skin type and sun habits, spot and skin-cancer checks, a health screen, and four photos",
  },
  {
    key: "eyelash_growth",
    label: "Eyelash growth",
    supported: true,
    asks: "what the patient wants for their lashes, how the lash loss came on, eye color, an eye and eyelid screen, chemotherapy history, and consent to the side effects",
  },
  {
    key: "nad_plus",
    label: "NAD+",
    supported: true,
    asks: "the patient's goals, a health screen with any history of cancer and kidney disease (with a nephrologist's approval), and whether they can give the injections",
  },
  {
    key: "glutathione",
    label: "Glutathione",
    supported: true,
    asks: "the patient's goals, a health screen with sulfur allergies and asthma, recent cancer treatment with the oncologist's approval, and whether they can give the injections",
  },
  {
    key: "sermorelin",
    label: "Sermorelin",
    supported: true,
    asks: "the patient's goals, height and weight, a health screen with any history of cancer, interacting medicines, and whether they can give the injections",
  },
  {
    key: "vitamin_b12",
    label: "Vitamin B12",
    supported: true,
    asks: "the patient's symptoms and how long, absorption and health screens, recent cancer treatment with the oncologist's approval, medicines, and whether they can give the injections",
  },
  {
    key: "oxytocin",
    label: "Oxytocin",
    supported: true,
    asks: "the patient's sleep and stress concerns, how they sleep, sleep disorders, mental health history, a suicide and behavioral health screen, a health screen, and consent to its off-label use",
  },
  {
    key: "erectile_dysfunction",
    label: "Erectile dysfunction",
    supported: true,
    asks: "the patient's goals and how the problem started, a recent blood pressure reading, heart, medicine and health screens, history, alcohol, and the promise never to take it with nitrates",
  },
  {
    key: "hair_loss",
    label: "Hair loss",
    supported: true,
    asks: "the patient's goals, where and how fast the hair is thinning, warning signs, mood, pregnancy and contraception, medicine and health screens, treatments tried, and the finasteride side effects",
  },
  {
    key: "herpes_simplex",
    label: "Herpes (HSV)",
    supported: true,
    asks: "whether the patient wants an outbreak treated or daily suppression, how and when it was diagnosed, this outbreak, how often they get them, urgent signs, health and allergy screens, and herpes medicines taken",
  },
];

/**
 * Categories that take another one's intake. A PCSK9 inhibitor plan
 * (`lipid_pcsk9`) asks the lipid intake and has its own lab policy, so the
 * form, the review and the copy are the lipid ones.
 */
const SAME_INTAKE: Record<string, ProgramKey> = { lipid_pcsk9: "lipid_management" };

/** The program whose intake, review and copy a category uses. */
export function intakeKey(key: ProgramKey): ProgramKey;
export function intakeKey(key: ProgramKey | undefined): ProgramKey | undefined;
export function intakeKey(key: ProgramKey | undefined): ProgramKey | undefined {
  return key === undefined ? undefined : SAME_INTAKE[key] ?? key;
}

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
