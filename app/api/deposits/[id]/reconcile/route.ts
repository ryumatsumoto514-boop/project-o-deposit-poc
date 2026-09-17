import { NextRequest, NextResponse } from "next/server";
import { reconcileDeposit } from "@/lib/reconcile";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deposit = await reconcileDeposit(params.id);
  if (!deposit) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ deposit });
}
