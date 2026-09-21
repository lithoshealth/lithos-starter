"use server";

import { redirect } from "next/navigation";
import { isDbConfigured } from "@/lib/db";
import { createMember, parseJoinForm } from "@/lib/join";
import type { JoinState } from "@/lib/join-state";

export async function joinAction(_previous: JoinState, formData: FormData): Promise<JoinState> {
  const parsed = parseJoinForm(formData);
  if (!parsed.ok) return { status: "failed", errors: parsed.errors };

  // Joining is the partner's own business — it writes to the partner's database
  // and never calls Lithos. Without that database there's nowhere to keep the
  // member, and the form says so rather than failing.
  if (!isDbConfigured()) {
    return { status: "failed", errors: [{ field: "database", message: "There's no member database connected, so this signup had nowhere to go." }] };
  }

  const { memberId } = await createMember(parsed.value);
  redirect(`/welcome/${encodeURIComponent(memberId)}`);
}
