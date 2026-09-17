// Core domain types for the Deposit Reconciliation Engine.
// See SPEC.md for the full state machine description.

export type DepositStatus =
  | "SIGNED"
  | "CONFIRMED_ONCHAIN"
  | "BRIDGING"
  | "CREDITED"
  | "STALLED_NO_GAS"
  | "STALLED_TIMEOUT"
  | "AMBIGUOUS";

export interface DepositRecord {
  id: string;
  userWallet: `0x${string}`; // funding source / login wallet
  destinationAccount: `0x${string}`; // Hyperliquid-side trading account (mocked)
  amount: string; // human-readable decimal string, e.g. "10.0"
  amountRaw: string; // base-unit string (bigint serialized), matches ERC-20 decimals
  asset: "USDC";
  sourceChainId: number; // 421614 for Arbitrum Sepolia
  status: DepositStatus;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  txHash: `0x${string}` | null; // the transferFrom() tx that actually moves funds
  explorerUrl: string | null;
  approveTxHash: `0x${string}` | null; // the exact/unlimited approve() tx
  kolRef: string | null; // attribution param from the entry link, e.g. "kol_alex"
  approvalMode: "exact" | "unlimited";
  failureReason: string | null; // plain-language classification, see lib/failures.ts
  reconciliation: {
    onchainConfirmed: boolean;
    onchainConfirmedAt: string | null; // frozen the moment it first flips true — NOT touched by later updates
    hyperliquidCredited: boolean;
    lastCheckedAt: string | null;
    ambiguousSince: string | null;
  };
}

export interface CreateDepositInput {
  userWallet: `0x${string}`;
  destinationAccount: `0x${string}`;
  amount: string;
  amountRaw: string;
  sourceChainId: number;
  kolRef: string | null;
  approvalMode: "exact" | "unlimited";
  approveTxHash: `0x${string}`;
}
