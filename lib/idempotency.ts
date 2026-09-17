import { depositStore } from "./store";
import type { DepositRecord } from "./types";

// Guards against the real "duplicate deposit" failure mode: a user resends
// the same amount while an earlier deposit for that wallet+amount hasn't
// reached CREDITED yet.
export function findConflictingInFlightDeposit(
  userWallet: string,
  amount: string
): DepositRecord | undefined {
  return depositStore.findInFlightByWalletAndAmount(userWallet, amount);
}
