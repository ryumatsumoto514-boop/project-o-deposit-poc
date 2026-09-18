import { NextRequest, NextResponse } from "next/server";
import { depositStore } from "@/lib/store";
import { findConflictingInFlightDeposit } from "@/lib/idempotency";
import { MAX_DEMO_AMOUNT } from "@/lib/constants";
import type { CreateDepositInput, DepositRecord } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ deposits: depositStore.list() });
}

export async function POST(req: NextRequest) {
  let body: CreateDepositInput;
  try {
    body = (await req.json()) as CreateDepositInput;
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

  if (!body.userWallet || !body.amount) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "userWallet and amount are required." },
      { status: 400 }
    );
  }

  const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
  if (typeof body.userWallet !== "string" || !ADDRESS_RE.test(body.userWallet)) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "userWallet must be a valid 0x-prefixed Ethereum address." },
      { status: 400 }
    );
  }
  if (body.destinationAccount !== undefined &&
      (typeof body.destinationAccount !== "string" || !ADDRESS_RE.test(body.destinationAccount))) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "destinationAccount must be a valid 0x-prefixed Ethereum address." },
      { status: 400 }
    );
  }

  const parsedAmount = Number(body.amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "amount must be a positive number." },
      { status: 400 }
    );
  }
  if (parsedAmount > MAX_DEMO_AMOUNT) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: `This demo caps deposits at ${MAX_DEMO_AMOUNT} USDC.` },
      { status: 400 }
    );
  }

  const conflict = findConflictingInFlightDeposit(body.userWallet, body.amount);
  if (conflict) {
    return NextResponse.json(
      {
        error: "DUPLICATE_IN_FLIGHT",
        message: `You already have a deposit in progress for this amount, opened at ${conflict.createdAt}. Do not send again — here's its current status.`,
        deposit: conflict,
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const record: DepositRecord = {
    id: crypto.randomUUID(),
    mockIdentity: body.mockIdentity ?? null,
    userWallet: body.userWallet,
    destinationAccount: body.destinationAccount,
    amount: body.amount,
    amountRaw: body.amountRaw,
    asset: "USDC",
    sourceChainId: body.sourceChainId,
    status: "SIGNED",
    createdAt: now,
    updatedAt: now,
    txHash: null,
    explorerUrl: null,
    approveTxHash: body.approveTxHash,
    kolRef: body.kolRef,
    approvalMode: body.approvalMode,
    failureReason: null,
    reconciliation: {
      onchainConfirmed: false,
      onchainConfirmedAt: null,
      hyperliquidCredited: false,
      lastCheckedAt: null,
      ambiguousSince: null,
    },
  };

  depositStore.create(record);
  return NextResponse.json({ deposit: record }, { status: 201 });
}
