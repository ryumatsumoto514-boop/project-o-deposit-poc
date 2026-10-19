import { decodeFunctionData } from "viem";
import { ARBISCAN_SEPOLIA_TX_URL, DEPOSIT_ADDRESS, ERC20_ABI, publicClient, USDC_ADDRESS } from "./chain";
import { pullDeposit } from "./relayer";
import { depositStore } from "./store";
import type { DepositRecord } from "./types";

export type PullOutcome =
  | { ok: true; deposit: DepositRecord | undefined }
  | { ok: false; reason: "APPROVAL_MISSING" | "APPROVAL_NOT_CONFIRMED" | "APPROVAL_FAILED" | "APPROVAL_INVALID" | "RELAYER_FAILED"; deposit: DepositRecord | undefined };

// Attempts the relayer's real transferFrom() call. Safe to call repeatedly:
// a no-op once txHash is set, and safe to retry after a prior failure (e.g.
// the relayer was temporarily out of gas) — nothing here assumes it's the
// first attempt. Shared by the /pull route (an explicit client-triggered
// attempt) and the reconciliation loop (which retries automatically on every
// poll tick, so a deposit self-heals once the underlying issue clears
// instead of sitting stuck until someone manually retries it).
// API retries and the reconciliation poll can overlap while the relayer RPC
// is in flight. Share one attempt per deposit in this process so concurrent
// callers cannot submit two transferFrom transactions before txHash is saved.
const inFlightPulls = new Map<string, Promise<PullOutcome>>();

export function attemptPull(deposit: DepositRecord): Promise<PullOutcome> {
  const existing = inFlightPulls.get(deposit.id);
  if (existing) return existing;

  const attempt = attemptPullOnce(deposit).finally(() => {
    inFlightPulls.delete(deposit.id);
  });
  inFlightPulls.set(deposit.id, attempt);
  return attempt;
}

async function attemptPullOnce(deposit: DepositRecord): Promise<PullOutcome> {
  if (deposit.txHash) {
    return { ok: true, deposit }; // already pulled
  }
  if (!deposit.approveTxHash) {
    return { ok: false, reason: "APPROVAL_MISSING", deposit };
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
      return { ok: false, reason: "APPROVAL_FAILED", deposit: updated };
    }

    // A successful hash alone is not proof that this wallet approved this
    // token/spender/amount. Never let an unrelated successful transaction
    // activate an allowance the wallet may have granted earlier.
    const approveTx = await publicClient.getTransaction({ hash: deposit.approveTxHash });
    let approval: ReturnType<typeof decodeFunctionData<typeof ERC20_ABI>>;
    try {
      approval = decodeFunctionData({ abi: ERC20_ABI, data: approveTx.input }) as typeof approval;
    } catch {
      return {
        ok: false,
        reason: "APPROVAL_INVALID",
        deposit: depositStore.update(deposit.id, {
          status: "STALLED_TIMEOUT",
          failureReason: "The confirmed transaction does not approve this deposit's token, wallet, spender, and amount. No transfer was submitted.",
        }),
      };
    }
    const approvedAmount = approval.args[1];
    const expectedAmount = BigInt(deposit.amountRaw);
    const amountMatches = deposit.approvalMode === "exact"
      ? approvedAmount === expectedAmount
      : typeof approvedAmount === "bigint" && approvedAmount >= expectedAmount;
    if (
      approveTx.from.toLowerCase() !== deposit.userWallet.toLowerCase() ||
      approveTx.to?.toLowerCase() !== USDC_ADDRESS.toLowerCase() ||
      approval.functionName !== "approve" ||
      String(approval.args[0]).toLowerCase() !== DEPOSIT_ADDRESS.toLowerCase() ||
      !amountMatches
    ) {
      return {
        ok: false,
        reason: "APPROVAL_INVALID",
        deposit: depositStore.update(deposit.id, {
          status: "STALLED_TIMEOUT",
          failureReason: "The confirmed transaction does not approve this deposit's token, wallet, spender, and amount. No transfer was submitted.",
        }),
      };
    }
  } catch {
    return { ok: false, reason: "APPROVAL_NOT_CONFIRMED", deposit };
  }

  try {
    const txHash = await pullDeposit(deposit.userWallet, BigInt(deposit.amountRaw));
    const updated = depositStore.update(deposit.id, {
      txHash,
      explorerUrl: ARBISCAN_SEPOLIA_TX_URL(txHash),
      status: "SIGNED",
      failureReason: null,
    });
    return { ok: true, deposit: updated };
  } catch (err) {
    // Don't blame "needs ETH" for every relayer-side failure — that's only
    // true for actual gas exhaustion. An insufficient-allowance revert, a
    // bad RPC response, etc. are a different problem with a different fix,
    // and telling a user to top up ETH for a problem that isn't ETH would
    // leave them stuck forever on bad advice. Only the real gas case gets
    // the gas-specific state; everything else gets an honest generic one.
    const message = err instanceof Error ? err.message : String(err);
    const isGasIssue = /insufficient funds|gas required exceeds|out of gas/i.test(message);
    const updated = depositStore.update(deposit.id, isGasIssue
      ? {
          status: "STALLED_NO_GAS",
          failureReason:
            "Our deposit relayer doesn't have enough testnet ETH to pay the transfer fee right now. This is an infrastructure issue on our side, not your wallet — we'll keep retrying automatically once it's topped up.",
        }
      : {
          status: "STALLED_TIMEOUT",
          failureReason:
            "Our deposit relayer hit an unexpected error trying to submit the transfer. We haven't confirmed the transfer outcome yet. Don't send another deposit. Keep this page open while we check and retry, and review your wallet history before trying again.",
        });
    return { ok: false, reason: "RELAYER_FAILED", deposit: updated };
  }
}
