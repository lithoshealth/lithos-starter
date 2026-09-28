/**
 * What the patient-facing site says, per program.
 *
 * Switching the program in /setup swaps all of this at once — the home page,
 * the care-review page, the page titles — so a demo can show the same company
 * selling lipid care one minute and weight loss the next. `{name}` is replaced
 * with the company name from starter.config.json.
 *
 * This is demo marketing copy for a fictional brand, not clinical guidance.
 * What a clinician actually checks is the program's protocol, which lives in
 * Lithos — the intake contract is in src/lib/intake/ and src/lib/journey.ts.
 */

import type { ProgramKey } from "../setup/programs";

type Titled = { name: string; body: string };

export type ProgramContent = {
  /** The line after the company name in the browser tab, and the home page eyebrow. */
  category: string;
  description: string;
  hero: { headline: string; lede: string; trust: string[]; includesTitle: string; includes: string[] };
  program: { eyebrow: string; headline: string; lede: string; phases: Array<{ when: string; title: string; body: string }> };
  coaching: { eyebrow: string; headline: string; lede: string; focuses: Titled[] };
  numbers: { headline: string; lede: string; items: Titled[] };
  care: { headline: string; paragraphs: string[]; reviewIncludes: string[] };
  plans: { headline: string; items: Array<{ name: string; price: string; tagline: string; featured?: boolean; includes: string[] }>; note: string };
  audiences: string[];
  cta: { headline: string; body: string };
  emergency: string;
  start: { heading: string; lede: string };
  /** What the sandbox clinician asks when the setup page's "Ask the patient a question" is chosen. */
  clinicianQuestion: string;
  /** A sample answer, pre-filled in the setup page's care-team inbox. */
  patientReply: string;
  /**
   * Where the plan buttons lead. Membership signup (/join) and the member pages
   * are written for the lipid program; for the others the buttons go straight
   * to a care review.
   */
  plansLeadTo: "join" | "start";
};

const LIPID: ProgramContent = {
  category: "Cardiometabolic membership",
  description: "A membership for managing cholesterol and cardiovascular risk: a panel every quarter, a coach who reads it with you, and medical care added when lifestyle alone isn't enough.",
  hero: {
    headline: "Know your numbers. Then actually move them.",
    lede: "{name} is a membership for people managing cholesterol and cardiovascular risk: a panel every quarter, a coach who reads it with you, and medical care added the moment lifestyle alone stops being enough.",
    trust: ["Quarterly at-home panels", "A named coach, not a chatbot", "Prescribing when it’s warranted — by licensed clinicians"],
    includesTitle: "What membership includes",
    includes: [
      "An at-home panel every quarter — LDL-C, ApoB, and Lp(a) once",
      "A coach who knows your history and your last four panels",
      "Targets written down, with the reasoning behind them",
      "Weekly check-ins aimed at one change at a time",
      "Medical care — clinician review, treatment, follow-up labs — when the numbers say so",
    ],
  },
  program: {
    eyebrow: "The coaching program",
    headline: "A quarter at a time, because that’s how fast the numbers answer.",
    lede: "Cholesterol doesn’t respond to a week of effort, and it doesn’t need a year to show whether something worked. Twelve weeks is roughly how long a real change takes to appear in a lipid panel, so that is the shape of the membership: test, decide, work, re-test.",
    phases: [
      { when: "Week 1", title: "Your panel arrives", body: "An at-home kit, drawn wherever you are. LDL-C, ApoB, HDL, triglycerides, A1c — and Lp(a) once, because it only needs measuring once in your life." },
      { when: "Week 2", title: "You and your coach read it together", body: "A call, not a PDF emailed into the void. You leave it with one or two targets written down and the reasoning behind them." },
      { when: "Weeks 3–11", title: "One thing at a time", body: "Weekly check-ins in the app, each aimed at a single change. Nobody has ever fixed their cholesterol by being handed nine instructions at once." },
      { when: "Week 12", title: "You re-test", body: "The next panel tells you whether it worked. If the numbers moved, we keep going. If they didn't, that's the moment to add medical care — not two years from now." },
    ],
  },
  coaching: {
    eyebrow: "What a coach actually works on",
    headline: "Four levers, worked one at a time.",
    lede: "Your coach isn’t a clinician and won’t pretend to be one. Their job is the part that happens between panels — and to notice early when it isn’t working.",
    focuses: [
      { name: "Diet", body: "Saturated fat and fibre, specifically — the two levers with the most evidence behind them for LDL-C. Not a meal plan you'll abandon in March." },
      { name: "Activity", body: "A floor you can actually hit on a bad week, raised slowly. Movement barely moves LDL-C on its own; it moves nearly everything else." },
      { name: "Sleep", body: "The one people skip. Short sleep undoes adherence, appetite and blood pressure at the same time, so we treat it as a lever, not a lifestyle bonus." },
      { name: "Adherence", body: "If you're on medication: taking it, taking it on time, and telling your coach the week side effects start — not at your next appointment." },
    ],
  },
  numbers: {
    headline: "The three numbers we watch.",
    lede: "Most cholesterol care stops at one number, once a year. We track the ones that predict risk — and treat to a target rather than a guess.",
    items: [
      { name: "LDL-C", body: "The “bad” cholesterol most guidelines target. The number we treat to — and the one that tells us when lifestyle alone has gone as far as it can." },
      { name: "ApoB", body: "A count of the particles that actually drive plaque. Often a truer picture of risk than LDL-C alone, and it can stay high after LDL-C looks fine." },
      { name: "Lp(a)", body: "A largely inherited risk factor most people have never been tested for. Once is enough — and if it's high, it changes how aggressive we should be." },
    ],
  },
  care: {
    headline: "Medical care is part of the membership, not a different company.",
    paragraphs: [
      "For a lot of members, the panels and the coaching are the whole story. For some — familial hypercholesterolemia, a stubborn LDL-C, a statin that made them ache — they aren’t. That is not a failure of effort, and it shouldn’t mean starting again somewhere else.",
      "When a quarter ends above target, your coach can open a care review. A clinician licensed in your state reads your history — your panels, your medications, what you’ve already tried — and decides with you what to add: a statin, ezetimibe, or a PCSK9 inhibitor where it’s warranted. Prescriptions ship to your door, follow-up labs are ordered, and your coach keeps going through all of it.",
    ],
    reviewIncludes: [
      "A short medical intake — history, current medications, anything you react to",
      "Clinician review against an evidence-based lipid protocol",
      "A treatment decision, and a message explaining it",
      "Follow-up labs and a recheck, usually at three months",
      "Refills handled without a new appointment",
    ],
  },
  plans: {
    headline: "Two plans. Both start with a panel.",
    items: [
      { name: "Essential", price: "$39", tagline: "The numbers, tracked and explained.", includes: ["A quarterly at-home lipid panel", "Habit tracking in the app", "A coach you can message, with a reply inside a working day", "Your full history in one place — every panel, every change"] },
      { name: "Complete", price: "$89", tagline: "Coaching, plus care when you need it.", featured: true, includes: ["Everything in Essential", "The extended panel: ApoB and hs-CRP quarterly, Lp(a) once", "A named coach and a call at the start of every quarter", "Medical care included when lifestyle isn't getting you to target — clinician review, prescription, and follow-up labs"] },
    ],
    note: "Billed monthly, cancel any time. Panels are included; medication and any labs ordered by a clinician outside the quarterly schedule are billed separately.",
  },
  audiences: [
    "Your LDL-C is high and you'd rather manage it than be told to watch it.",
    "Heart disease or high cholesterol runs in your family, and you want to know your real risk.",
    "You tried a statin, felt bad on it, and stopped — and nobody offered you an alternative.",
    "You get a panel once a year at a physical, and nothing happens between panels.",
  ],
  cta: { headline: "Start with the panel.", body: "Everything else follows from knowing the numbers — and from someone reading them with you." },
  emergency: "{name} does not provide emergency care. If you’re having chest pain, shortness of breath, or symptoms of a stroke, call 911.",
  start: {
    heading: "Let’s add medical care to your membership.",
    lede: "A care review is how coaching hands over to a clinician. Tell us about your history, what you’re taking now, and your most recent cholesterol results — a clinician licensed in your state reviews every one.",
  },
  clinicianQuestion: "Before I decide: which cholesterol medicines have you taken before, and did any of them cause side effects?",
  patientReply: "I took atorvastatin 20 mg for about a year. It gave me muscle aches, so I stopped last spring.",
  plansLeadTo: "join",
};

const WEIGHT: ProgramContent = {
  category: "Medical weight loss",
  description: "Medical weight loss with a coach: a clinician decides whether a GLP-1 is right for you, and a coach helps you keep the weight off.",
  hero: {
    headline: "Lose the weight. Keep it off.",
    lede: "{name} pairs GLP-1 medication, prescribed by a licensed clinician when it’s right for you, with a coach who works on everything the medication doesn’t: protein, strength, and the habits that decide what happens next.",
    trust: ["A clinician decides, not an algorithm", "A named coach, not a chatbot", "Medication ships to your door"],
    includesTitle: "What the program includes",
    includes: [
      "A clinician review of your health history — usually within a day",
      "GLP-1 medication when it’s safe and right for you",
      "Dose check-ins, so you step up only when you’re ready",
      "A coach focused on protein, strength and side effects",
      "Refills without a new appointment",
    ],
  },
  program: {
    eyebrow: "How the program works",
    headline: "Start low, go slow, and keep what you lose.",
    lede: "GLP-1s work best started at a low dose and stepped up as your body adjusts. The program follows that rhythm: a review to start, a check-in before every dose change, and a coach in between.",
    phases: [
      { when: "Day 1", title: "Your clinician review", body: "A short health intake, reviewed by a clinician licensed in your state. If a GLP-1 is right for you, the prescription goes out that day." },
      { when: "Weeks 1–4", title: "The starting dose", body: "The lowest dose, so your body can adjust. Your coach checks in on appetite, nausea and what you’re eating — side effects are easiest to manage early." },
      { when: "Monthly", title: "Step up when you’re ready", body: "Before each dose increase, a quick check-in with your clinician. You move up when it’s working and you’re tolerating it — not on a fixed calendar." },
      { when: "Month 3", title: "Your progress review", body: "Weight, how you feel, what’s changed. Then the plan for the next three months, including how to protect the muscle you want to keep." },
    ],
  },
  coaching: {
    eyebrow: "What a coach actually works on",
    headline: "The medication changes your appetite. Your coach helps with the rest.",
    lede: "Your coach isn’t a clinician and won’t pretend to be one. Their job is the part the medication doesn’t do — and noticing early when something isn’t working.",
    focuses: [
      { name: "Protein", body: "Eating less makes protein matter more. Enough of it is what keeps the weight you lose from being muscle." },
      { name: "Strength", body: "Two short sessions a week, built up slowly. It’s the difference between losing weight and getting stronger while you do." },
      { name: "Side effects", body: "Nausea, constipation, low energy — most are manageable with small changes, if someone notices them early." },
      { name: "Habits", body: "What you eat when your appetite comes back is what decides the long term. You build those habits now, while it’s easier." },
    ],
  },
  numbers: {
    headline: "What we track.",
    lede: "The scale is one number. We watch the ones that tell us whether the weight you’re losing is the weight you want to lose.",
    items: [
      { name: "Weight", body: "Tracked weekly, read monthly. A steady trend matters more than any single weigh-in." },
      { name: "BMI", body: "Part of how your clinician decides whether a GLP-1 is right for you — and how we measure where you’ve got to." },
      { name: "A1c", body: "Your average blood sugar. Weight loss often brings it down, and it’s one of the clearest signs the program is working." },
    ],
  },
  care: {
    headline: "Medical care is the program, not an add-on.",
    paragraphs: [
      "Every plan starts with a clinician review. A clinician licensed in your state reads your history — your weight, your conditions, what you’ve tried before — and decides whether a GLP-1 is safe and right for you.",
      "If it is, they prescribe one — semaglutide or tirzepatide, for example — and the medication ships to your door. Your clinician checks in before each dose change, and your coach keeps going through all of it.",
    ],
    reviewIncludes: [
      "A short medical intake — height, weight, health history, current medications",
      "Clinician review against an evidence-based weight-management protocol",
      "A treatment decision, and a message explaining it",
      "A check-in before each dose increase",
      "Refills handled without a new appointment",
    ],
  },
  plans: {
    headline: "Two plans. Both start with a clinician review.",
    items: [
      { name: "Coaching", price: "$49", tagline: "A coach and a clinician, no medication.", includes: ["A clinician review of your health history", "A named coach and weekly check-ins", "Nutrition and strength plans built around you", "Your progress in one place"] },
      { name: "Complete", price: "$129", tagline: "Coaching, plus GLP-1 medication when it’s right for you.", featured: true, includes: ["Everything in Coaching", "GLP-1 prescription when it’s safe and right for you", "A clinician check-in before every dose change", "Refills without a new appointment"] },
    ],
    note: "Billed monthly, cancel any time. Medication is billed separately; we’ll tell you what it costs before it ships.",
  },
  audiences: [
    "You’ve tried to lose weight on your own, more than once, and it keeps coming back.",
    "You’re curious about GLP-1s and want a clinician to tell you honestly whether they’re right for you.",
    "You’re already on a GLP-1 and want someone paying attention to the rest — protein, strength, side effects.",
    "Your weight is affecting your blood pressure, blood sugar or sleep, and you want to do something about it.",
  ],
  cta: { headline: "Start with a clinician review.", body: "A few minutes of questions. A clinician licensed in your state reads every one." },
  emergency: "{name} does not provide emergency care. If you’re having chest pain, shortness of breath, or symptoms of a stroke, call 911.",
  start: {
    heading: "Let’s see whether a GLP-1 is right for you.",
    lede: "A few minutes of questions about your health, your weight and what you’re taking now — a clinician licensed in your state reviews every one and decides on treatment.",
  },
  clinicianQuestion: "Before I decide: have you taken a GLP-1 or another weight-loss medicine before? If so, which one, at what dose, and how did it go?",
  patientReply: "Yes — semaglutide 0.5 mg for three months last year. I stopped because of the nausea.",
  plansLeadTo: "start",
};

const CONTENT: Record<ProgramKey, ProgramContent> = { lipid_management: LIPID, weight_management: WEIGHT };

export function contentFor(program: ProgramKey): ProgramContent {
  return CONTENT[program];
}

/** Put the company name into a line of copy. */
export function withName(text: string, name: string): string {
  return text.replaceAll("{name}", name);
}
