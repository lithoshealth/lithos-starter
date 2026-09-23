/**
 * What makes this copy of the starter *yours*: brand, program, intake style.
 *
 * Kept in `starter.config.json` at the repo root, not in env vars or the
 * browser, for two reasons. It changes live — the setup page writes it and
 * every page reads it on the next request, so a choice made on a call shows up
 * in the app immediately. And it's committed with the code: the repo you hand a
 * prospect after a demo already carries their name, colour and program.
 *
 * Nothing secret goes here. Credentials stay in `.env.local`.
 *
 * Writing is development only, like `.env.local` — a deployed copy reads the
 * committed file and treats it as fixed.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PROGRAMS, type ProgramKey } from "./setup/programs";
import { INTAKE_STYLES, type IntakeStyle } from "./intake/styles";

export { INTAKE_STYLES, type IntakeStyle };

export type Brand = {
  /** The company name, shown in the header, titles and page copy. */
  name: string;
  tagline: string;
  /** The primary colour, `#rrggbb`. Buttons, links and accents derive from it. */
  color: string;
  /** Path under /public, e.g. `/brand/logo.png`. Unset shows the default mark. */
  logo?: string;
};

export type StarterConfig = {
  brand: Brand;
  /**
   * The program the company offers — Lithos's care-plan category. It decides
   * what the whole site says, what the intake asks and which protocol a
   * clinician reviews against. Unset until chosen in /setup step 2; the site
   * shows the lipid program meanwhile.
   */
  program?: ProgramKey;
  /** How the care-review intake is asked: one question per screen, or everything on one page. */
  intakeStyle: IntakeStyle;
};


/** What the site shows before a program has been chosen. */
export const DEFAULT_PROGRAM: ProgramKey = "lipid_management";

export const DEFAULT_CONFIG: StarterConfig = {
  brand: { name: "Eucardia Health", tagline: "Good heart.", color: "#1e5e59" },
  intakeStyle: "quiz",
};

const FILE = "starter.config.json";
const HEX = /^#[0-9a-f]{6}$/i;

function configPath() {
  return path.join(process.cwd(), FILE);
}

/** Anything missing or malformed falls back to the default, field by field — a hand-edited file can't break the app. */
export function normalizeConfig(raw: unknown): StarterConfig {
  const brand = (raw as { brand?: Partial<Brand> } | null)?.brand ?? {};
  const program = (raw as { program?: unknown } | null)?.program;
  const intakeStyle = (raw as { intakeStyle?: unknown } | null)?.intakeStyle;
  const text = (value: unknown, fallback: string, max: number) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
  return {
    brand: {
      name: text(brand.name, DEFAULT_CONFIG.brand.name, 60),
      tagline: text(brand.tagline, DEFAULT_CONFIG.brand.tagline, 120),
      color: typeof brand.color === "string" && HEX.test(brand.color) ? brand.color.toLowerCase() : DEFAULT_CONFIG.brand.color,
      // Only our own upload path — never an arbitrary URL.
      logo: typeof brand.logo === "string" && /^\/brand\/logo\.(png|jpe?g|webp)(\?v=\d+)?$/.test(brand.logo) ? brand.logo : undefined,
    },
    program: PROGRAMS.some((p) => p.key === program) ? (program as ProgramKey) : undefined,
    intakeStyle: INTAKE_STYLES.some((s) => s.key === intakeStyle) ? (intakeStyle as IntakeStyle) : DEFAULT_CONFIG.intakeStyle,
  };
}

export async function readConfig(): Promise<StarterConfig> {
  try {
    return normalizeConfig(JSON.parse(await readFile(configPath(), "utf8")));
  } catch {
    return DEFAULT_CONFIG;
  }
}

export const configWritable = () => process.env.NODE_ENV === "development";

/** Merge a change into the file. Development only; returns false if it can't write. `program: null` clears the choice. */
export async function updateConfig(change: { brand?: Partial<Brand>; program?: ProgramKey | null; intakeStyle?: IntakeStyle }): Promise<boolean> {
  if (!configWritable()) return false;
  const current = await readConfig();
  const program = change.program === null ? undefined : (change.program ?? current.program);
  const next = normalizeConfig({ ...current, brand: { ...current.brand, ...change.brand }, program, intakeStyle: change.intakeStyle ?? current.intakeStyle });
  try {
    await writeFile(configPath(), `${JSON.stringify(next, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}
