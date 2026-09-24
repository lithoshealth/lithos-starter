"use server";

import { readdir, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { configWritable, INTAKE_STYLES, updateConfig, type IntakeStyle } from "@/lib/starter-config";
import { importFromWebsite, type SiteImport } from "@/lib/setup/site-import";

/**
 * The choices that tailor the app — brand (the panel at the top of /setup) and
 * intake style (step 3) — saved to starter.config.json and applied to every
 * page on its next render. The program is step 2's own action. Development
 * only — a deployed copy's choices are whatever was committed.
 */

export type BrandActionState = { status: "idle" | "saved" } | { status: "error"; message: string };

const READ_ONLY: BrandActionState = {
  status: "error",
  message: "This copy is deployed, so its brand is fixed. Change it in a local copy and redeploy.",
};

function refreshEverything() {
  // The brand is in the root layout, so every page needs a fresh render.
  revalidatePath("/", "layout");
}

export async function saveBrandAction(_prev: BrandActionState, formData: FormData): Promise<BrandActionState> {
  if (!configWritable()) return READ_ONLY;
  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  if (!name) return { status: "error", message: "Give the company a name." };
  if (!(await updateConfig({ brand: { name, tagline, color } }))) {
    return { status: "error", message: "Couldn't write starter.config.json. Check the folder is writable." };
  }
  refreshEverything();
  return { status: "saved" };
}

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
// Under the default 1 MB server-action body limit, with room for the form around it.
const MAX_LOGO_BYTES = 800 * 1024;
const BRAND_DIR = () => path.join(process.cwd(), "public", "brand");

async function clearLogos() {
  const dir = BRAND_DIR();
  const files = await readdir(dir).catch(() => [] as string[]);
  await Promise.all(files.filter((f) => f.startsWith("logo.")).map((f) => rm(path.join(dir, f), { force: true })));
}

/**
 * The logo goes to public/brand/, so it ships with the repo like the rest of
 * the brand. PNG, JPEG or WebP only: an SVG can carry script, and this file is
 * served from the app's own origin.
 */
export async function uploadLogoAction(_prev: BrandActionState, formData: FormData): Promise<BrandActionState> {
  if (!configWritable()) return READ_ONLY;
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose an image file." };
  const ext = LOGO_TYPES[file.type];
  if (!ext) return { status: "error", message: "Use a PNG, JPEG or WebP image." };
  if (file.size > MAX_LOGO_BYTES) return { status: "error", message: "That image is over 800 KB — a logo this size will slow every page. Use a smaller one." };

  const bytes = Buffer.from(await file.arrayBuffer());
  await mkdir(BRAND_DIR(), { recursive: true });
  await clearLogos();
  await writeFile(path.join(BRAND_DIR(), `logo.${ext}`), bytes);
  // A logo more than about twice as wide as it is tall is a wordmark — it
  // already says the name, so the header shouldn't say it again.
  const size = imageSize(bytes);
  const logoWide = size ? size.width / size.height >= 2.2 : false;
  // The version stamp makes browsers fetch the new file instead of a cached old one.
  await updateConfig({ brand: { logo: `/brand/logo.${ext}?v=${Date.now()}`, logoWide } });
  refreshEverything();
  return { status: "saved" };
}

/** Width and height from a PNG, JPEG or WebP header — enough to tell a wordmark from an icon. */
function imageSize(b: Buffer): { width: number; height: number } | null {
  if (b.length > 24 && b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  }
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

export async function removeLogoAction(): Promise<BrandActionState> {
  if (!configWritable()) return READ_ONLY;
  await clearLogos();
  await updateConfig({ brand: { logo: undefined, logoWide: undefined } });
  refreshEverything();
  return { status: "saved" };
}

export async function setIntakeStyleAction(_prev: BrandActionState, formData: FormData): Promise<BrandActionState> {
  if (!configWritable()) return READ_ONLY;
  const style = String(formData.get("intakeStyle") ?? "") as IntakeStyle;
  if (!INTAKE_STYLES.some((s) => s.key === style)) return { status: "error", message: "Pick an intake style." };
  if (!(await updateConfig({ intakeStyle: style }))) return { status: "error", message: "Couldn't write starter.config.json." };
  refreshEverything();
  return { status: "saved" };
}

export type ImportState =
  | { status: "idle" }
  | { status: "found"; result: SiteImport }
  | { status: "error"; message: string };

/**
 * "Import from your website": read the prospect's site and return what it
 * suggests. Nothing is saved here — the panel shows the suggestions and applies
 * only what's picked.
 */
export async function importWebsiteAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  if (!configWritable()) return { status: "error", message: "This copy is deployed, so its brand is fixed." };
  const result = await importFromWebsite(String(formData.get("website") ?? ""));
  return "error" in result ? { status: "error", message: result.error } : { status: "found", result };
}

/** Use a Google Font for the brand, or (no family) go back to the starter's own fonts. */
export async function setFontAction(font: { family: string; css: string } | null): Promise<BrandActionState> {
  if (!configWritable()) return READ_ONLY;
  if (!(await updateConfig({ brand: { font: font ?? undefined } }))) return { status: "error", message: "Couldn't save the font." };
  refreshEverything();
  return { status: "saved" };
}
