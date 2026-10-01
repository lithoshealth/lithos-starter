/**
 * "Your plan": the program around the prescription — the coaching, the
 * check-ins, the recheck. This is the partner's own program, not Lithos's:
 * Lithos decides and prescribes; what a member hears week to week is yours.
 * The steps below are ILLUSTRATIVE — edit them to match your program. They're
 * dated from the day the clinician approved the plan, and the refill check-in
 * is Lithos's real date, not a guess.
 */

type Step = { day: number; title: string; detail: string; firstDose?: boolean };

const STEPS: Record<string, Step[]> = {
  lipid_management: [
    { day: 0, title: "Your plan is approved", detail: "Your clinician signed off on your treatment." },
    { day: 3, title: "First dose", detail: "Your coach walks you through it.", firstDose: true },
    { day: 14, title: "Two-week check-in", detail: "How you're feeling, and any side effects." },
    { day: 56, title: "Recheck your LDL-C", detail: "A blood test shows how well it's working." },
    { day: 90, title: "Three-month review", detail: "Your clinician adjusts the plan toward your target." },
  ],
  weight_management: [
    { day: 0, title: "Your plan is approved", detail: "Your clinician signed off on your treatment." },
    { day: 3, title: "First dose", detail: "Your coach walks you through it.", firstDose: true },
    { day: 14, title: "Two-week check-in", detail: "Appetite, side effects, and how you're eating." },
    { day: 28, title: "Dose review", detail: "Whether it's time to step up the dose." },
    { day: 84, title: "Three-month review", detail: "Your progress, and the plan for the next three months." },
  ],
};

/** `date` is null for a step that waits on something rather than a day — the first dose waits on the delivery. */
export type JourneyItem = { date: string | null; title: string; detail: string; state: "done" | "next" | "later"; fromLithos?: boolean };

const DAY = 24 * 60 * 60 * 1000;

/**
 * The steps, dated from the approval. The first dose isn't a date: it happens
 * when the medication arrives, so it's dated by the delivery (Lithos's order),
 * and until then it's the next thing — not "done" because a day went by.
 */
export function journey(program: string | undefined, approvedAt: string | null, refillDueAt: string | null, deliveredAt: string | null, now: Date): JourneyItem[] {
  if (!approvedAt) return [];
  const start = new Date(approvedAt).getTime();
  const items = (STEPS[program ?? ""] ?? STEPS.lipid_management).map((step) => ({
    sortAt: start + step.day * DAY,
    date: step.firstDose ? deliveredAt : new Date(start + step.day * DAY).toISOString(),
    title: step.title,
    detail: step.firstDose && !deliveredAt ? `When it arrives. ${step.detail}` : step.detail,
    fromLithos: undefined as boolean | undefined,
  }));
  if (refillDueAt) {
    items.push({ sortAt: new Date(refillDueAt).getTime(), date: refillDueAt, title: "Refill check-in", detail: "A few questions, then your next supply.", fromLithos: true });
  }
  items.sort((a, b) => a.sortAt - b.sortAt);

  let nextFound = false;
  return items.map(({ sortAt: _sortAt, ...item }) => {
    // Nothing after a step still to come can be done, whatever the calendar says.
    if (!nextFound && item.date && new Date(item.date).getTime() <= now.getTime()) return { ...item, state: "done" };
    if (!nextFound) { nextFound = true; return { ...item, state: "next" }; }
    return { ...item, state: "later" };
  });
}
