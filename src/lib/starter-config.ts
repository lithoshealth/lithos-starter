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
import { isProgramKey, type ProgramKey } from "./setup/programs";
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
  /** The logo is a wordmark — wide, with the name in it — so the header shows it alone. */
  logoWide?: boolean;
  /**
   * A Google Fonts family for headings and body text, and the css2 query that
   * loads it (checked against Google Fonts when it was chosen). Unset keeps the
   * starter's own fonts.
   */
  font?: { family: string; css: string };
  /**
   * The page background, `#rrggbb`. Light colours only: every page is dark text
   * on a light page. Unset keeps the starter's cream.
   */
  background?: string;
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

/** Light enough for dark text to read on it — the bar a page background has to clear. */
export function isLight(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b >= 0.75;
}

/** A font is only kept if both parts are plain: it ends up in a stylesheet URL and a CSS rule. */
function validFont(font: unknown): Brand["font"] {
  const f = font as { family?: unknown; css?: unknown } | null | undefined;
  if (typeof f?.family !== "string" || typeof f.css !== "string") return undefined;
  if (!/^[A-Za-z0-9 ]{2,40}$/.test(f.family) || !/^[A-Za-z0-9+:@;,.]{2,80}$/.test(f.css)) return undefined;
  return { family: f.family, css: f.css };
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
      logoWide: brand.logo && brand.logoWide === true ? true : undefined,
      font: validFont(brand.font),
      background: typeof brand.background === "string" && HEX.test(brand.background) && isLight(brand.background) ? brand.background.toLowerCase() : undefined,
    },
    program: isProgramKey(program) ? program : undefined,
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
