"use server";

import { readdir, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { configWritable, INTAKE_STYLES, updateConfig, type IntakeStyle } from "@/lib/starter-config";
import { programFor } from "@/lib/setup/programs";
import { formularyHas } from "@/lib/setup/steps";
import { lithosConnection } from "@/lib/lithos/connection";

/**
 * "Make it yours": the brand choices, saved to starter.config.json and applied
 * to every page on its next render. Development only — a deployed copy's brand
 * is whatever was committed.
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

  await mkdir(BRAND_DIR(), { recursive: true });
  await clearLogos();
  await writeFile(path.join(BRAND_DIR(), `logo.${ext}`), Buffer.from(await file.arrayBuffer()));
  // The version stamp makes browsers fetch the new file instead of a cached old one.
  await updateConfig({ brand: { logo: `/brand/logo.${ext}?v=${Date.now()}` } });
  refreshEverything();
  return { status: "saved" };
}

export async function removeLogoAction(): Promise<BrandActionState> {
  if (!configWritable()) return READ_ONLY;
  await clearLogos();
  await updateConfig({ brand: { logo: undefined } });
  refreshEverything();
  return { status: "saved" };
}

/**
 * The program, from the "Make it yours" panel — the same choice as step 2 of
 * the walkthrough, in the place a demo starts. When the app is connected the
 * choice is checked against the live formulary first, so the panel can't
 * offer a program the organization can't prescribe in.
 */
export async function setProgramAction(_prev: BrandActionState, formData: FormData): Promise<BrandActionState> {
  if (!configWritable()) return READ_ONLY;
  const program = programFor(String(formData.get("program") ?? ""));
  if (!program) return { status: "error", message: "Pick a program." };
  if (lithosConnection().connected) {
    try {
      if (!(await formularyHas(program.key))) {
        return { status: "error", message: `Your Lithos organization isn't provisioned for ${program.label.toLowerCase()} yet. Ask your Lithos contact to add it.` };
      }
    } catch {
      return { status: "error", message: "Couldn't reach Lithos to check your formulary. Try again in a moment." };
    }
  }
  if (!(await updateConfig({ program: program.key }))) return { status: "error", message: "Couldn't write starter.config.json." };
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
