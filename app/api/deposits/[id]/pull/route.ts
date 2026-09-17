import { NextRequest, NextResponse } from "next/server";
import { depositStore } from "@/lib/store";
import { pullDeposit } from "@/lib/relayer";
import { ARBISCAN_SEPOLIA_TX_URL, publicClient } from "@/lib/chain";

// Triggers the relayer's real transferFrom() call — the second half of the
// approve() + transferFrom() pattern — once the user's approve() has been
// signed. Independently re-checks the approve receipt server-side rather
// than trusting the client's word that it confirmed.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deposit = depositStore.get(params.id);
  if (!deposit) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (deposit.txHash) {
    return NextResponse.json({ deposit }); // already pulled, idempotent
  }
  if (!deposit.approveTxHash) {
    return NextResponse.json({ error: "APPROVAL_MISSING" }, { status: 400 });
  }

  try {
    const approveReceipt = await publicClient.getTransactionReceipt({
      hash: deposit.approveTxHash,
    });
    if (approveReceipt.status !== "success") {
      const updated = depositStore.update(deposit.id, {
        status: "STALLED_TIMEOUT",
        failureReason:
          "The approval transaction failed on-chain, so we can't pull funds yet.",
      });
      return NextResponse.json({ deposit: updated }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: "APPROVAL_NOT_CONFIRMED" }, { status: 425 });
  }

  try {
    const txHash = await pullDeposit(
      deposit.userWallet,
      BigInt(deposit.amountRaw)
    );
    const updated = depositStore.update(deposit.id, {
      txHash,
      explorerUrl: ARBISCAN_SEPOLIA_TX_URL(txHash),
    });
    return NextResponse.json({ deposit: updated });
  } catch (err) {
    const updated = depositStore.update(deposit.id, {
      status: "STALLED_NO_GAS",
      failureReason:
        "Our deposit relayer couldn't submit the transfer right now. This is an infrastructure issue on our side, not your wallet — please try again shortly.",
    });
    return NextResponse.json(
      { error: "RELAYER_FAILED", message: String(err), deposit: updated },
      { status: 502 }
    );
  }
}
