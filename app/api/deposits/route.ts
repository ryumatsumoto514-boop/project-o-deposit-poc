import { NextRequest, NextResponse } from "next/server";
import { parseUnits } from "viem";
import { CHAIN, USDC_DECIMALS } from "@/lib/chain";
import { depositStore } from "@/lib/store";
import { findConflictingInFlightDeposit } from "@/lib/idempotency";
import { MAX_DEMO_AMOUNT } from "@/lib/constants";
import type { CreateDepositInput, DepositRecord } from "@/lib/types";

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

  if (!body.userWallet || !body.amount || !body.destinationAccount) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "userWallet, destinationAccount, and amount are required." },
      { status: 400 }
    );
  }

  if (body.mockIdentity != null && typeof body.mockIdentity !== "string") {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "mockIdentity must be a string or null." },
      { status: 400 }
    );
  }

  if (
    body.approveTxHash != null &&
    (typeof body.approveTxHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(body.approveTxHash))
  ) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "approveTxHash must be a 0x-prefixed 32-byte transaction hash." },
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
  if (typeof body.destinationAccount !== "string" || !ADDRESS_RE.test(body.destinationAccount)) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "destinationAccount must be a valid 0x-prefixed Ethereum address." },
      { status: 400 }
    );
  }

  if (typeof body.amount !== "string") {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "amount must be a decimal string." },
      { status: 400 }
    );
  }

  // USDC has six decimal places. Number() also accepts hex and exponent
  // notation, which are not valid decimal token amounts for parseUnits().
  if (!/^\d+(?:\.\d{1,6})?$/.test(body.amount)) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "amount must be a decimal string with at most 6 decimal places." },
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

  if (body.sourceChainId !== CHAIN.id) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: `sourceChainId must be ${CHAIN.id} (Arbitrum Sepolia).` },
      { status: 400 }
    );
  }

  if (body.kolRef != null && typeof body.kolRef !== "string") {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "kolRef must be a string or null." },
      { status: 400 }
    );
  }

  if (body.approvalMode !== "exact" && body.approvalMode !== "unlimited") {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "approvalMode must be \"exact\" or \"unlimited\"." },
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
    // The relayer must transfer exactly the validated, displayed amount.
    amountRaw: parseUnits(body.amount, USDC_DECIMALS).toString(),
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
