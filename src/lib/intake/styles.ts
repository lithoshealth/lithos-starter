/** How the care-review intake is asked. Client-safe: the setup panel lists these. */
export type IntakeStyle = "quiz" | "form";

export const INTAKE_STYLES: Array<{ key: IntakeStyle; label: string; description: string }> = [
  { key: "quiz", label: "Quiz", description: "One question per screen, like a consumer app" },
  { key: "form", label: "Single page", description: "Every question on one page, one submit" },
];
