import { NextRequest, NextResponse } from "next/server";
import { depositStore } from "@/lib/store";
import { attemptPull } from "@/lib/pull";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

// Triggers the relayer's real transferFrom() call — the second half of the
// approve() + transferFrom() pattern — once the user's approve() has been
// signed. Independently re-checks the approve receipt server-side rather
// than trusting the client's word that it confirmed. Safe to call again if
// a prior attempt failed (e.g. the relayer was out of gas) — see lib/pull.ts.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // This endpoint can cause an on-chain transfer once approval is confirmed.
  // Reject cross-origin browser requests so a third-party page cannot trigger
  // a pull merely by learning a public status URL.
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) {
    return privateJson({ error: "INVALID_ORIGIN" }, 403);
  }

  const deposit = depositStore.get(params.id);
  if (!deposit) {
    return privateJson({ error: "NOT_FOUND" }, 404);
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
        : outcome.reason === "APPROVAL_INVALID"
        ? 400
        : 502;
    return privateJson(
      { error: outcome.reason, deposit: outcome.deposit },
      status
    );
  }
  return privateJson({ deposit: outcome.deposit });
}
