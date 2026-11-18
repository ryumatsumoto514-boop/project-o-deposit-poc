import { NextRequest, NextResponse } from "next/server";
import { reconcileDeposit } from "@/lib/reconcile";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deposit = await reconcileDeposit(params.id);
  if (!deposit) {
    return privateJson({ error: "NOT_FOUND" }, 404);
  }
  return privateJson({ deposit });
}
