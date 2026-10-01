/**
 * The Support tab's answers. The partner's own help content — ILLUSTRATIVE,
 * written for the demo; replace with yours. Anything a patient needs a person
 * for goes to Messages, which is the care team through Lithos.
 */

export type Answer = { topic: string; question: string; answer: string };

export function supportAnswers(brandName: string, program: string | undefined): Answer[] {
  const weight = program === "weight_management";
  return [
    {
      topic: "Shipping",
      question: "How long until my order arrives?",
      answer: "Once your clinician approves your plan, your prescription goes straight to the pharmacy. You can follow it on your Home tab, from the pharmacy to your door.",
    },
    {
      topic: "Prescription",
      question: "When can I get a refill?",
      answer: "Your Home tab shows your next refill check-in. When it's time, you answer a few questions and your clinician renews your prescription.",
    },
    {
      topic: "Medication",
      question: "What side effects should I watch for?",
      answer: weight
        ? "Nausea and a smaller appetite are common in the first weeks. Tell your care team about anything that worries you. If it's an emergency, call 911."
        : "Most people feel nothing at all. Tell your care team about muscle aches, or anything else that worries you. If it's an emergency, call 911.",
    },
    {
      topic: "Account",
      question: "Can I change my shipping address?",
      answer: `Yes. Message your care team before your next order ships and ${brandName} will update it.`,
    },
    {
      topic: "Care",
      question: "Who are my clinicians?",
      answer: "Licensed physicians and nurse practitioners in your state review every request and stay with you through your plan.",
    },
  ];
}
