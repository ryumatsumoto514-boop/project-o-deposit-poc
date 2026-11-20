import { NextRequest, NextResponse } from "next/server";
import { decodeFunctionData, parseUnits } from "viem";
import { CHAIN, DEPOSIT_ADDRESS, ERC20_ABI, publicClient, USDC_ADDRESS, USDC_DECIMALS } from "@/lib/chain";
import { depositStore } from "@/lib/store";
import { findConflictingInFlightDeposit } from "@/lib/idempotency";
import { MAX_DEMO_AMOUNT } from "@/lib/constants";
import { deriveMockTradingAccount } from "@/lib/hyperliquidMock";
import type { CreateDepositInput, DepositRecord } from "@/lib/types";

function privateJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...init?.headers,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  // Creating a record reserves this wallet/amount pair and can block the
  // user's next attempt. Require a same-origin browser request so a third
  // party cannot use a public approval transaction to create that reservation.
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) {
    return privateJson({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

  let body: CreateDepositInput;
  try {
    body = (await req.json()) as CreateDepositInput;
  } catch {
    return privateJson(
      { error: "INVALID_REQUEST", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return privateJson(
      { error: "INVALID_REQUEST", message: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  if (!body.userWallet || !body.amount || !body.destinationAccount) {
    return privateJson(
      { error: "INVALID_REQUEST", message: "userWallet, destinationAccount, and amount are required." },
      { status: 400 }
    );
  }

  if (body.mockIdentity != null && typeof body.mockIdentity !== "string") {
    return privateJson(
      { error: "INVALID_REQUEST", message: "mockIdentity must be a string or null." },
      { status: 400 }
    );
  }
  if (typeof body.mockIdentity === "string" && body.mockIdentity.length > 120) {
    return privateJson(
      { error: "INVALID_REQUEST", message: "mockIdentity must be at most 120 characters." },
      { status: 400 }
    );
  }

  if (
    body.approveTxHash != null &&
    (typeof body.approveTxHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(body.approveTxHash))
  ) {
    return privateJson(
      { error: "INVALID_REQUEST", message: "approveTxHash must be a 0x-prefixed 32-byte transaction hash." },
      { status: 400 }
    );
  }

  const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
  if (typeof body.userWallet !== "string" || !ADDRESS_RE.test(body.userWallet)) {
    return privateJson(
      { error: "INVALID_REQUEST", message: "userWallet must be a valid 0x-prefixed Ethereum address." },
      { status: 400 }
    );
  }
  if (typeof body.destinationAccount !== "string" || !ADDRESS_RE.test(body.destinationAccount)) {
    return privateJson(
      { error: "INVALID_REQUEST", message: "destinationAccount must be a valid 0x-prefixed Ethereum address." },
      { status: 400 }
    );
  }
  // The approval transaction binds the wallet, token, spender, and amount,
  // but it cannot bind the mocked trading destination. Keep that public
  // metadata tied to the signing wallet instead of accepting caller input.
  if (body.destinationAccount.toLowerCase() !== deriveMockTradingAccount(body.userWallet as `0x${string}`).toLowerCase()) {
    return privateJson(
      { error: "INVALID_REQUEST", message: "destinationAccount does not match this wallet's demo trading account." },
      { status: 400 }
    );
  }

  if (typeof body.amount !== "string") {
    return privateJson(
      { error: "INVALID_REQUEST", message: "amount must be a decimal string." },
      { status: 400 }
    );
  }

  // USDC has six decimal places. Number() also accepts hex and exponent
  // notation, which are not valid decimal token amounts for parseUnits().
  if (!/^(?:\d+(?:\.\d{1,6})?|\.\d{1,6})$/.test(body.amount)) {
    return privateJson(
      { error: "INVALID_REQUEST", message: "amount must be a decimal string with at most 6 decimal places." },
      { status: 400 }
    );
  }

  const parsedAmount = Number(body.amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return privateJson(
      { error: "INVALID_REQUEST", message: "amount must be a positive number." },
      { status: 400 }
    );
  }
  if (parsedAmount > MAX_DEMO_AMOUNT) {
    return privateJson(
      { error: "INVALID_REQUEST", message: `This demo caps deposits at ${MAX_DEMO_AMOUNT} MockUSDC.` },
      { status: 400 }
    );
  }

  if (body.sourceChainId !== CHAIN.id) {
    return privateJson(
      { error: "INVALID_REQUEST", message: `sourceChainId must be ${CHAIN.id} (Arbitrum Sepolia).` },
      { status: 400 }
    );
  }

  if (body.kolRef != null && typeof body.kolRef !== "string") {
    return privateJson(
      { error: "INVALID_REQUEST", message: "kolRef must be a string or null." },
      { status: 400 }
    );
  }
  if (typeof body.kolRef === "string" && body.kolRef.length > 120) {
    return privateJson(
      { error: "INVALID_REQUEST", message: "kolRef must be at most 120 characters." },
      { status: 400 }
    );
  }

  if (body.approvalMode !== "exact") {
    return privateJson(
      { error: "INVALID_REQUEST", message: "Only exact-amount approvals are supported." },
      { status: 400 }
    );
  }

  // A public create endpoint must not let an arbitrary caller reserve another
  // wallet's wallet/amount pair with a missing or unrelated transaction hash.
  // The transaction may still be pending here; /pull independently verifies
  // its successful receipt before any funds are transferred.
  if (!body.approveTxHash) {
    return privateJson(
      { error: "APPROVAL_MISSING", message: "A wallet approval transaction is required." },
      { status: 400 }
    );
  }
  let approvalTx;
  try {
    approvalTx = await publicClient.getTransaction({ hash: body.approveTxHash as `0x${string}` });
  } catch {
    return privateJson(
      { error: "APPROVAL_NOT_FOUND", message: "The approval is not visible on Arbitrum Sepolia yet. Try again shortly." },
      { status: 425 }
    );
  }
  try {
    const approval = decodeFunctionData({ abi: ERC20_ABI, data: approvalTx.input });
    const requestedAmount = parseUnits(body.amount, USDC_DECIMALS);
    const approvedAmount = approval.args[1];
    const amountMatches = approvedAmount === requestedAmount;
    if (
      approvalTx.from.toLowerCase() !== body.userWallet.toLowerCase() ||
      approvalTx.to?.toLowerCase() !== USDC_ADDRESS.toLowerCase() ||
      approval.functionName !== "approve" ||
      String(approval.args[0]).toLowerCase() !== DEPOSIT_ADDRESS.toLowerCase() ||
      !amountMatches
    ) {
      throw new Error("Approval does not match deposit");
    }
  } catch {
    return privateJson(
      { error: "APPROVAL_INVALID", message: "The transaction does not approve this wallet, token, spender, and amount." },
      { status: 400 }
    );
  }

  // A reverted approve still has valid-looking calldata. Do not let an old,
  // failed transaction reserve this wallet/amount pair. A missing receipt is
  // allowed here because the UI creates the record while the approval is
  // pending, then waits for its receipt before triggering the pull.
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: body.approveTxHash as `0x${string}` });
    if (receipt.status === "reverted") {
      return privateJson(
        { error: "APPROVAL_FAILED", message: "The approval transaction reverted and did not grant an allowance." },
        { status: 409 }
      );
    }
  } catch {
    // Pending transactions have no receipt yet; /pull verifies successful
    // confirmation before any transferFrom call.
  }

  const conflict = findConflictingInFlightDeposit(body.userWallet, body.amount);
  if (conflict) {
    return privateJson(
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
    asset: "MockUSDC",
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
  return privateJson({ deposit: record }, { status: 201 });
}
