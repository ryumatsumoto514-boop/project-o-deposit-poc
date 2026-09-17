import { ARBISCAN_SEPOLIA_TX_URL, publicClient } from "./chain";
import { pullDeposit } from "./relayer";
import { depositStore } from "./store";
import type { DepositRecord } from "./types";

export type PullOutcome =
  | { ok: true; deposit: DepositRecord | undefined }
  | { ok: false; reason: "APPROVAL_MISSING" | "APPROVAL_NOT_CONFIRMED" | "APPROVAL_FAILED" | "RELAYER_FAILED"; deposit: DepositRecord | undefined };

// Attempts the relayer's real transferFrom() call. Safe to call repeatedly:
// a no-op once txHash is set, and safe to retry after a prior failure (e.g.
// the relayer was temporarily out of gas) — nothing here assumes it's the
// first attempt. Shared by the /pull route (an explicit client-triggered
// attempt) and the reconciliation loop (which retries automatically on every
// poll tick, so a deposit self-heals once the underlying issue clears
// instead of sitting stuck until someone manually retries it).
export async function attemptPull(deposit: DepositRecord): Promise<PullOutcome> {
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
            "Our deposit relayer couldn't submit the transfer right now. This is an infrastructure issue on our side, not your wallet — we'll keep retrying automatically.",
        }
      : {
          status: "STALLED_TIMEOUT",
          failureReason:
            "Our deposit relayer hit an unexpected error trying to submit the transfer. Your funds are not at risk — we'll keep retrying automatically.",
        });
    return { ok: false, reason: "RELAYER_FAILED", deposit: updated };
  }
}
