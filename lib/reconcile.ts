import { publicClient } from "./chain";
import { isHyperliquidCredited } from "./hyperliquidMock";
import { attemptPull } from "./pull";
import { depositStore } from "./store";
import type { DepositRecord } from "./types";

const TIMEOUT_MS = 5 * 60 * 1000; // 5 min without progress => STALLED_TIMEOUT
const AMBIGUOUS_THRESHOLD_MS = 60 * 1000; // one side settled, other lagging this long => AMBIGUOUS

// Independently checks (a) real source-chain tx status via RPC and (b) the
// mocked Hyperliquid-side balance, and only advances to CREDITED when both
// agree. Called by POST /api/deposits/[id]/reconcile (polled by the client
// status tracker, or a cron in a real deployment).
export async function reconcileDeposit(id: string): Promise<DepositRecord | undefined> {
  let deposit = depositStore.get(id);
  if (!deposit || deposit.status === "CREDITED") return deposit;

  // Self-heal: if the deposit-moving transferFrom() hasn't gone out yet —
  // including a prior attempt that failed because the relayer was out of
  // gas — retry it on every poll instead of leaving it stuck until someone
  // manually retries. Safe to call repeatedly (see lib/pull.ts).
  if (!deposit.txHash && deposit.approveTxHash) {
    const outcome = await attemptPull(deposit);
    deposit = outcome.deposit ?? deposit;
    if (!deposit.txHash) {
      return deposit; // still not pulled — nothing else to reconcile this tick
    }
  }

  const now = Date.now();
  let onchainConfirmed = deposit.reconciliation.onchainConfirmed;

  if (deposit.txHash && !onchainConfirmed) {
    try {
      const receipt = await publicClient.getTransactionReceipt({
        hash: deposit.txHash,
      });
      onchainConfirmed = receipt.status === "success";
    } catch {
      // Not mined yet — leave as unconfirmed, timeout logic below handles staleness.
    }
  }

  // Frozen the moment this first flips true. depositStore.update() bumps
  // `updatedAt` on every poll tick, so that field can't be used as a stand-in
  // for "when did this confirm" — it would never accumulate any elapsed time.
  const onchainConfirmedAt = onchainConfirmed
    ? deposit.reconciliation.onchainConfirmedAt ?? new Date().toISOString()
    : null;

  const hyperliquidCredited =
    onchainConfirmed && onchainConfirmedAt
      ? isHyperliquidCredited(onchainConfirmedAt)
      : false;

  let status: DepositRecord["status"] = deposit.status;
  let ambiguousSince = deposit.reconciliation.ambiguousSince;

  if (onchainConfirmed && hyperliquidCredited) {
    status = "CREDITED";
    ambiguousSince = null;
  } else if (onchainConfirmed && !hyperliquidCredited && onchainConfirmedAt) {
    status = status === "SIGNED" ? "CONFIRMED_ONCHAIN" : "BRIDGING";
    const sinceConfirmed = now - new Date(onchainConfirmedAt).getTime();
    if (sinceConfirmed > AMBIGUOUS_THRESHOLD_MS && !ambiguousSince) {
      // one side (chain) settled, other side (Hyperliquid) still lagging
      // past the expected window — flag, don't silently keep polling forever.
      status = "AMBIGUOUS";
      ambiguousSince = new Date().toISOString();
    }
  } else {
    const sinceCreated = now - new Date(deposit.createdAt).getTime();
    if (sinceCreated > TIMEOUT_MS) {
      status = "STALLED_TIMEOUT";
    }
  }

  return depositStore.update(id, {
    status,
    // Clear any stale exception copy once we're genuinely progressing again
    // — onchainConfirmed only gets here once the receipt is real.
    failureReason: onchainConfirmed ? null : deposit.failureReason,
    reconciliation: {
      onchainConfirmed,
      onchainConfirmedAt,
      hyperliquidCredited,
      lastCheckedAt: new Date().toISOString(),
      ambiguousSince,
    },
  });
}
