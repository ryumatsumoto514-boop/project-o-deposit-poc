import { NextResponse } from "next/server";
import { publicClient } from "@/lib/chain";

// Poll live RPC on each request instead of freezing telemetry at build time.
export const dynamic = "force-dynamic";

// Read-only display endpoint for the nav's gas indicator — a genuine live
// RPC read (publicClient.getGasPrice()), not a fabricated number. Kept out
// of lib/ since it's UI-only telemetry, not reconciliation-engine logic.
export async function GET() {
  try {
    const gasPrice = await publicClient.getGasPrice();
    return NextResponse.json({ gwei: Number(gasPrice) / 1e9 });
  } catch {
    return NextResponse.json({ gwei: null });
  }
}
