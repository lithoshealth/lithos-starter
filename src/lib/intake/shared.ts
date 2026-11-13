/**
 * Parsing helpers the newer intakes share (UTI, sinusitis, pink eye,
 * testosterone replacement and menopausal hormone therapy). Client-safe.
 */

export type Options = readonly (readonly [string, string])[];
export type FieldError = { pointer: string; message: string };
export type Read = { text: (name: string) => string; all: (name: string) => string[]; checked: (name: string) => boolean };
export type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; errors: FieldError[] };

export const pointer = (name: string) => `/intake_form/data/${name}`;
export const keys = (options: Options) => options.map(([key]) => key);
export const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
export const booleans = (read: Read, ...lists: Options[]) =>
  Object.fromEntries(lists.flat().map(([name]) => [name, read.checked(name)]));
export const picked = (read: Read, name: string, options: Options) => read.all(name).filter((v) => keys(options).includes(v));

export function oneOf(read: Read, name: string, options: Options, errors: FieldError[], message: string): string {
  const value = read.text(name);
  if (!keys(options).includes(value)) errors.push({ pointer: pointer(name), message });
  return value;
}

export function count(read: Read, name: string, errors: FieldError[], message: string, max = 52): number {
  const raw = read.text(name);
  const value = Number(raw);
  if (raw === "" || !Number.isInteger(value) || value < 0 || value > max) errors.push({ pointer: pointer(name), message });
  return value;
}

export function isoDate(read: Read, name: string, errors: FieldError[], message: string): string {
  const value = read.text(name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) errors.push({ pointer: pointer(name), message });
  return value;
}

/** A detail Lithos requires only when its yes/no is yes, and refuses otherwise. */
export function detailWhen(read: Read, asked: boolean, name: string, errors: FieldError[], message: string): Record<string, string> {
  const value = read.text(name).trim();
  if (!asked) return {};
  if (!value) errors.push({ pointer: pointer(name), message });
  return { [name]: value };
}

export const BLOOD_PRESSURE_SETTINGS: Options = [["home", "At home"], ["pharmacy", "At a pharmacy"], ["clinic", "At a clinic"]];

/** The four blood pressure fields Lithos asks with a protocol that needs a recent reading. */
export function bloodPressure(read: Read, errors: FieldError[]) {
  const whole = (name: string, message: string) => {
    const value = Number(read.text(name));
    if (!Number.isInteger(value) || value < 1) errors.push({ pointer: pointer(name), message });
    return value;
  };
  return {
    blood_pressure_systolic: whole("blood_pressure_systolic", "Enter the top number of your blood pressure."),
    blood_pressure_diastolic: whole("blood_pressure_diastolic", "Enter the bottom number of your blood pressure."),
    blood_pressure_measured_on: isoDate(read, "blood_pressure_measured_on", errors, "Enter the date of your blood pressure reading."),
    blood_pressure_setting: oneOf(read, "blood_pressure_setting", BLOOD_PRESSURE_SETTINGS, errors, "Pick where the reading was taken."),
  };
}
