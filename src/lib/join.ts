/**
 * Membership signup — Eucardia's own funnel.
 *
 * Nothing here touches Lithos. That is the point: a member joins, pays (not in
 * this build), gets panels and coaching, and exists in Eucardia's database for
 * months before any clinician sees them. Escalation to Lithos happens later,
 * from the member record, and only for the members who need it.
 *
 * Two things this deliberately does NOT collect, because a real membership
 * business has no reason to:
 *   - the eight protocol screening booleans (contraindications)
 *   - telehealth consent
 * Both are asked at escalation instead. Membership consent is not telehealth
 * consent and cannot be inherited as such — which is why a sixteen-month member
 * still faces a fresh clinical questionnaire the first time they escalate.
 */

import { getDb, newId, newMemberId } from "./db";
import type { JoinError } from "./join-state";

export type { JoinError, JoinState } from "./join-state";

export type JoinInput = {
  plan: "essential" | "complete";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  sex: "female" | "male";
  address: { line1: string; line2: string | null; city: string; state: string; postalCode: string };
  /** Optional: a result they already have from their own doctor. */
  priorPanel: { ldlC: number; drawnOn: string; totalCholesterol: number | null } | null;
  /** Optional free text: what they take for cholesterol today. */
  currentLipidMedication: string | null;
};

// Eucardia's two coaches. A named coach is assigned at join; the seed data has
// one member without one, which is simply a member who joined before this flow.
const COACHES = ["Dana Whitfield", "Marcus Adeyemi"] as const;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function isSyntheticName(value: string): boolean {
  return /\b(sample|test)\b/i.test(value);
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function parseJoinForm(formData: FormData): { ok: true; value: JoinInput } | { ok: false; errors: JoinError[] } {
  const errors: JoinError[] = [];
  const push = (fieldName: string, message: string) => errors.push({ field: fieldName, message });

  const plan = field(formData, "plan");
  const firstName = field(formData, "first_name");
  const lastName = field(formData, "last_name");
  const email = field(formData, "email").toLowerCase();
  const phone = field(formData, "phone");
  const dateOfBirth = field(formData, "date_of_birth");
  const sex = field(formData, "sex");

  if (plan !== "essential" && plan !== "complete") push("plan", "Choose a membership plan.");

  // Same synthetic-data guards as the clinical intake. This is a sandbox build;
  // real member details must not reach it, whichever door they come through.
  if (!isSyntheticName(firstName) && !isSyntheticName(lastName)) {
    push("first_name", "Use an obviously fake Sample or Test name — this is a demo build.");
  }
  if (!/^[^@\s]+@example\.com$/i.test(email)) push("email", "Use an example.com email address.");
  if (!/^\+1\d{3}555\d{4}$/.test(phone)) push("phone", "Use a US +1 number in the reserved 555 range, e.g. +12125550142.");
  if (!isValidIsoDate(dateOfBirth)) push("date_of_birth", "Enter a valid date of birth.");
  if (sex !== "female" && sex !== "male") push("sex", "Select a valid sex.");

  for (const [name, label] of [["address_line1", "Street address"], ["city", "City"], ["state", "State"], ["postal_code", "ZIP code"]] as const) {
    if (!field(formData, name)) push(name, `${label} is required — panels ship to your door.`);
  }

  if (formData.get("membership_consent") !== "on") {
    push("membership_consent", "Please accept the membership terms.");
  }
  if (formData.get("sample_attestation") !== "on") {
    push("sample_attestation", "Confirm these are sample details, not a real person's.");
  }

  // The prior panel is optional, but if either half is given both must be.
  const ldlCRaw = field(formData, "prior_ldl_c");
  const drawnOn = field(formData, "prior_drawn_on");
  let priorPanel: JoinInput["priorPanel"] = null;
  if (ldlCRaw || drawnOn) {
    const ldlC = Number(ldlCRaw);
    if (!Number.isFinite(ldlC) || ldlC <= 0) push("prior_ldl_c", "Enter a positive LDL-C value, or leave both fields blank.");
    if (!isValidIsoDate(drawnOn)) push("prior_drawn_on", "Enter the date this result was drawn.");
    else if (Date.parse(`${drawnOn}T00:00:00Z`) > Date.now()) push("prior_drawn_on", "That date is in the future.");
    const totalRaw = field(formData, "prior_total_cholesterol");
    const total = totalRaw ? Number(totalRaw) : null;
    if (totalRaw && (!Number.isFinite(total) || (total ?? 0) <= 0)) push("prior_total_cholesterol", "Enter a positive value, or leave it blank.");
    if (errors.length === 0) priorPanel = { ldlC, drawnOn, totalCholesterol: total };
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      plan: plan as "essential" | "complete",
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      sex: sex as "female" | "male",
      address: {
        line1: field(formData, "address_line1"),
        line2: field(formData, "address_line2") || null,
        city: field(formData, "city"),
        state: field(formData, "state"),
        postalCode: field(formData, "postal_code"),
      },
      priorPanel,
      currentLipidMedication: field(formData, "current_lipid_medication") || null,
    },
  };
}

/**
 * Create the member, plus anything they arrived carrying. One transaction: a
 * member who joined but whose prior lab silently vanished is worse than a
 * failed signup, because nothing downstream would ever notice.
 */
export async function createMember(input: JoinInput): Promise<{ memberId: string; coach: string }> {
  const sql = getDb();
  const memberId = newMemberId();
  const coach = COACHES[Math.floor(Math.random() * COACHES.length)];

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO members ${tx({
        id: memberId,
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
        date_of_birth: input.dateOfBirth,
        sex: input.sex,
        phone: input.phone,
        address_line1: input.address.line1,
        address_line2: input.address.line2,
        city: input.address.city,
        state: input.address.state,
        postal_code: input.address.postalCode,
        plan: input.plan,
        status: "active",
        coach_name: coach,
      })}`;

    if (input.priorPanel) {
      await tx`
        INSERT INTO lab_panels ${tx({
          id: newId("eu_lab"),
          member_id: memberId,
          drawn_on: input.priorPanel.drawnOn,
          source: "external",
          ldl_c: input.priorPanel.ldlC,
          total_cholesterol: input.priorPanel.totalCholesterol,
          notes: "Reported by the member at signup, from their own doctor.",
        })}`;
    }

    if (input.currentLipidMedication) {
      await tx`
        INSERT INTO member_medications ${tx({
          id: newId("eu_med"),
          member_id: memberId,
          name: input.currentLipidMedication,
          kind: "lipid_lowering",
          notes: "Self-reported at signup.",
        })}`;
    }
  });

  return { memberId, coach };
}

/** A member's own welcome view — no Lithos state, because there isn't any yet. */
export async function getJoinedMember(memberId: string): Promise<
  | { member: { id: string; first_name: string; last_name: string; email: string; plan: string; coach_name: string | null; joined_at: string; lithos_patient_id: string | null }; priorLdl: string | null; priorDrawnOn: string | Date | null }
  | null
> {
  const sql = getDb();
  const [member] = await sql<Array<{ id: string; first_name: string; last_name: string; email: string; plan: string; coach_name: string | null; joined_at: string; lithos_patient_id: string | null }>>`
    SELECT id, first_name, last_name, email, plan, coach_name, joined_at, lithos_patient_id
      FROM members WHERE id = ${memberId}`;
  if (!member) return null;

  const [panel] = await sql<Array<{ ldl_c: string | null; drawn_on: string | Date }>>`
    SELECT ldl_c, drawn_on FROM lab_panels WHERE member_id = ${memberId} ORDER BY drawn_on DESC LIMIT 1`;

  return { member, priorLdl: panel?.ldl_c ?? null, priorDrawnOn: panel?.drawn_on ?? null };
}
