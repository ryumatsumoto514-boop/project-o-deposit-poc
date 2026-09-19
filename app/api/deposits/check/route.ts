import { NextRequest, NextResponse } from "next/server";
import { findConflictingInFlightDeposit } from "@/lib/idempotency";
import { MAX_DEMO_AMOUNT } from "@/lib/constants";

// Pre-flight duplicate check, called before the wallet signature prompt so
// a blocked user never wastes gas on an approve() they can't use.
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const amount = req.nextUrl.searchParams.get("amount");
  if (!wallet || !amount) {
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }
  // Match deposit creation: invalid input must not look like a clear preflight.
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "wallet must be a valid 0x-prefixed Ethereum address." },
      { status: 400 }
    );
  }
  const parsedAmount = Number(amount);
  if (
    !/^\d+(?:\.\d{1,6})?$/.test(amount) ||
    !Number.isFinite(parsedAmount) ||
    parsedAmount <= 0 ||
    parsedAmount > MAX_DEMO_AMOUNT
  ) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: `amount must be a positive decimal string with at most 6 decimal places, capped at ${MAX_DEMO_AMOUNT} USDC.` },
      { status: 400 }
    );
  }
  const conflict = findConflictingInFlightDeposit(wallet, amount);
  return NextResponse.json({ conflict: conflict ?? null });
}
