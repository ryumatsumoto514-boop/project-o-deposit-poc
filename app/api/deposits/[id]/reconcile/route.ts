import { NextRequest, NextResponse } from "next/server";
import { reconcileDeposit } from "@/lib/reconcile";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Reconciliation may submit transferFrom() when a confirmed approval has
  // not yet been pulled, so it needs the same browser-origin check as /pull.
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) {
    return privateJson({ error: "INVALID_ORIGIN" }, 403);
  }

  const deposit = await reconcileDeposit(params.id);
  if (!deposit) {
    return privateJson({ error: "NOT_FOUND" }, 404);
  }
  return privateJson({ deposit });
}
