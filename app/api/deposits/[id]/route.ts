import { NextRequest, NextResponse } from "next/server";
import { depositStore } from "@/lib/store";
import { canTransition } from "@/lib/stateMachine";
import { publicClient } from "@/lib/chain";
import type { DepositStatus } from "@/lib/types";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deposit = depositStore.get(params.id);
  if (!deposit) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: PRIVATE_NO_STORE });
  }
  return NextResponse.json({ deposit }, { headers: PRIVATE_NO_STORE });
}

// Client-observed failures only — e.g. the user's own approve() tx reverted
// or was dropped. Servers can't see wallet-side errors, so the client
// reports them here to keep the record honest instead of leaving it stuck.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deposit = depositStore.get(params.id);
  if (!deposit) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  let body: { status?: DepositStatus; failureReason?: string };
  try {
    body = (await req.json()) as {
      status?: DepositStatus;
      failureReason?: string;
    };
  } catch {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  // Client-reported failures are not evidence. The only currently supported
  // client report is a reverted approval; verify that outcome from the
  // configured chain RPC before allowing it to change the public record.
  if (body.status !== "STALLED_TIMEOUT") {
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
  }
  // Client reports are only used for a failed wallet approval, before the
  // relayer starts the deposit transfer. Once reconciliation has observed
  // on-chain progress, a client must not overwrite that evidence with a
  // stale or forged timeout report.
  if (deposit.status !== "SIGNED") {
    return NextResponse.json(
      {
        error: "INVALID_TRANSITION",
        message: "Client-reported failures are only accepted before the deposit transfer starts.",
      },
      { status: 409 }
    );
  }
  if (!canTransition(deposit.status, body.status)) {
    return NextResponse.json(
      {
        error: "INVALID_TRANSITION",
        message: `Cannot move a deposit from ${deposit.status} to ${body.status}.`,
      },
      { status: 409 }
    );
  }
  if (!deposit.approveTxHash) {
    return NextResponse.json({ error: "APPROVAL_MISSING" }, { status: 409 });
  }
  let approvalReceipt;
  try {
    approvalReceipt = await publicClient.getTransactionReceipt({ hash: deposit.approveTxHash });
  } catch {
    return NextResponse.json({ error: "APPROVAL_NOT_CONFIRMED" }, { status: 425 });
  }
  if (approvalReceipt.status !== "reverted") {
    return NextResponse.json(
      { error: "APPROVAL_NOT_REVERTED", message: "The approval transaction has not been shown to fail on-chain." },
      { status: 409 }
    );
  }
  // Receipt lookup yields to other requests. Re-read before writing so a
  // reconciliation that advanced the deposit while RPC was in flight wins.
  const current = depositStore.get(deposit.id);
  if (
    !current ||
    current.status !== "SIGNED" ||
    current.approveTxHash !== deposit.approveTxHash
  ) {
    return NextResponse.json(
      {
        error: "INVALID_TRANSITION",
        message: "The deposit changed while the approval failure was being checked. Refresh its status.",
      },
      { status: 409 }
    );
  }
  const updated = depositStore.update(deposit.id, {
    status: body.status,
    failureReason: "The approval transaction failed on-chain, so we can't pull funds yet.",
  });
  return NextResponse.json({ deposit: updated });
}
