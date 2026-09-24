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
/** Relative luminance (WCAG) of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function brandCss(brand: Brand): string {
  const c = brand.color;
  // A light brand colour (a pale teal, a yellow) can't carry white text, and is
  // too faint as link text on the cream page — so the text on it turns dark,
  // and wherever the colour is used *as* text, a darker shade of it stands in.
  const light = luminance(c) > 0.4;
  const onPrimary = light ? "#1b2130" : "#fff";
  const ink = luminance(c) > 0.18 ? `color-mix(in srgb,${c} 55%,black)` : c;
  const colors = `:root{--primary:${c};--primary-hover:color-mix(in srgb,${c} 82%,black);--primary-soft:color-mix(in srgb,${c} 11%,white);--primary-deep:color-mix(in srgb,${c} 78%,white);--on-primary:${onPrimary};--primary-ink:${ink}}`;
  // `html:root` outranks the class next/font puts on <html> for its own variables.
  const font = brand.font ? `html:root{--font-sans:"${brand.font.family}";--font-display:"${brand.font.family}"}` : "";
  return colors + font;
}

/** The Google Fonts stylesheet for the brand's font, if it has one. */
export function brandFontHref(brand: Brand): string | null {
  return brand.font ? `https://fonts.googleapis.com/css2?family=${brand.font.css}&display=swap` : null;
}

/** Everything a patient-facing page needs to know about this copy: brand, program and the program's copy. */
export async function getSite() {
  const config = await readConfig();
  const program = config.program ?? DEFAULT_PROGRAM;
  return { brand: config.brand, program, intakeStyle: config.intakeStyle, content: contentFor(program) };
}
