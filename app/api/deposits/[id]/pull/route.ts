import { NextRequest, NextResponse } from "next/server";
import { depositStore } from "@/lib/store";
import { attemptPull } from "@/lib/pull";

// Triggers the relayer's real transferFrom() call — the second half of the
// approve() + transferFrom() pattern — once the user's approve() has been
// signed. Independently re-checks the approve receipt server-side rather
// than trusting the client's word that it confirmed. Safe to call again if
// a prior attempt failed (e.g. the relayer was out of gas) — see lib/pull.ts.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deposit = depositStore.get(params.id);
  if (!deposit) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const outcome = await attemptPull(deposit);
  if (!outcome.ok) {
    const status =
      outcome.reason === "APPROVAL_NOT_CONFIRMED"
        ? 425
        : outcome.reason === "APPROVAL_MISSING"
        ? 400
        : outcome.reason === "APPROVAL_FAILED"
        ? 409
        : 502;
    return NextResponse.json(
      { error: outcome.reason, deposit: outcome.deposit },
      { status }
    );
  }
  return NextResponse.json({ deposit: outcome.deposit });
}
