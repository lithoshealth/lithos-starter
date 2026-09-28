/** How the care-review intake is asked. Client-safe: the setup page lists these. */
export type IntakeStyle = "quiz" | "chat";

export const INTAKE_STYLES: Array<{ key: IntakeStyle; label: string; description: string }> = [
  { key: "quiz", label: "Quiz", description: "One question per screen, like a consumer app" },
  { key: "chat", label: "Chat", description: "A conversation: each question a message, each answer a reply" },
];
