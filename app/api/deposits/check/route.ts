import { NextRequest, NextResponse } from "next/server";
import { findConflictingInFlightDeposit } from "@/lib/idempotency";

// Pre-flight duplicate check, called before the wallet signature prompt so
// a blocked user never wastes gas on an approve() they can't use.
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const amount = req.nextUrl.searchParams.get("amount");
  if (!wallet || !amount) {
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }
  const conflict = findConflictingInFlightDeposit(wallet, amount);
  return NextResponse.json({ conflict: conflict ?? null });
}
