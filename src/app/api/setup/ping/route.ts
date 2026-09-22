import { NextResponse } from "next/server";
import { pingProof } from "@/lib/setup/reachability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Answers "is this address really this app?" for the setup walkthrough's
 * pre-registration check. The proof is an HMAC of the client secret — enough
 * to recognise the same configuration, useless for recovering the secret.
 */
export function GET(): NextResponse {
  return NextResponse.json({ app: "lithos-starter", proof: pingProof() }, { headers: { "cache-control": "no-store" } });
}
