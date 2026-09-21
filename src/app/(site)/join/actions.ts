"use server";

import { redirect } from "next/navigation";
import { createMember, parseJoinForm } from "@/lib/join";
import type { JoinState } from "@/lib/join-state";

export async function joinAction(_previous: JoinState, formData: FormData): Promise<JoinState> {
  const parsed = parseJoinForm(formData);
  if (!parsed.ok) return { status: "failed", errors: parsed.errors };

  const { memberId } = await createMember(parsed.value);
  redirect(`/welcome/${encodeURIComponent(memberId)}`);
}
