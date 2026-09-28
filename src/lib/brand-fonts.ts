/**
 * The fonts the setup page offers, all from Google Fonts and all checked to
 * serve the weights the app uses (400, 600, 700). A font imported from a
 * prospect's website is offered too, even if it isn't on this list.
 *
 * Client-safe: no server imports.
 */

export type BrandFont = { family: string; css: string };

const font = (family: string): BrandFont => ({ family, css: `${family.replace(/ /g, "+")}:wght@400;600;700` });

export const FONT_CHOICES: Array<{ group: string; fonts: BrandFont[] }> = [
  { group: "Sans serif", fonts: ["Inter", "DM Sans", "Manrope", "Plus Jakarta Sans", "Nunito Sans", "Source Sans 3", "Work Sans", "Montserrat", "Poppins", "Outfit"].map(font) },
  { group: "Serif", fonts: ["Fraunces", "Source Serif 4", "Playfair Display", "Lora", "Libre Baskerville", "Merriweather"].map(font) },
];
