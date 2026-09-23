import { contentFor } from "./programs/content";
import { DEFAULT_PROGRAM, readConfig, type Brand } from "./starter-config";

/**
 * The brand this copy of the starter wears, from `starter.config.json`.
 * The setup page's "Make it yours" panel edits it live; nothing in the
 * integration depends on it.
 */
export async function getBrand(): Promise<Brand> {
  return (await readConfig()).brand;
}

/**
 * The brand colour as CSS custom properties. The stylesheet's own hover and
 * soft tints are for the default green, so both are derived here instead — a
 * prospect's colour gets matching shades without anyone picking three colours.
 */
export function brandCss(brand: Brand): string {
  const c = brand.color;
  return `:root{--primary:${c};--primary-hover:color-mix(in srgb,${c} 82%,black);--primary-soft:color-mix(in srgb,${c} 11%,white);--primary-deep:color-mix(in srgb,${c} 78%,white)}`;
}

/** Everything a patient-facing page needs to know about this copy: brand, program and the program's copy. */
export async function getSite() {
  const config = await readConfig();
  const program = config.program ?? DEFAULT_PROGRAM;
  return { brand: config.brand, program, intakeStyle: config.intakeStyle, content: contentFor(program) };
}
