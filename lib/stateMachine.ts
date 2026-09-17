import type { DepositStatus } from "./types";

// Allowed forward transitions. CREDITED is a terminal, "true done" state.
// STALLED_* and AMBIGUOUS are recoverable side-states the reconciliation
// engine can move out of once the underlying condition clears.
export const TRANSITIONS: Record<DepositStatus, DepositStatus[]> = {
  SIGNED: ["CONFIRMED_ONCHAIN", "STALLED_NO_GAS", "STALLED_TIMEOUT"],
  CONFIRMED_ONCHAIN: ["BRIDGING", "STALLED_TIMEOUT", "AMBIGUOUS"],
  BRIDGING: ["CREDITED", "STALLED_TIMEOUT", "AMBIGUOUS"],
  CREDITED: [],
  STALLED_NO_GAS: ["SIGNED", "CONFIRMED_ONCHAIN"],
  STALLED_TIMEOUT: ["CONFIRMED_ONCHAIN", "BRIDGING", "AMBIGUOUS"],
  AMBIGUOUS: ["BRIDGING", "CREDITED"],
};

export function canTransition(from: DepositStatus, to: DepositStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
