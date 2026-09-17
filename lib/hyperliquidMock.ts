// MOCK Hyperliquid-side balance check. We do not have real Hyperliquid
// testnet access, so this simulates the "collateral credited and tradable"
// signal that the reconciliation engine cross-checks against on-chain state.
// This MUST stay clearly labeled as mocked in the UI and README.

import { keccak256, toBytes, getAddress } from "viem";

const BRIDGING_DELAY_MS = { min: 15_000, max: 30_000 };

// There is no real Hyperliquid testnet account here — this deterministically
// derives a plausible-looking mock trading-account address per user wallet
// purely so the UI can label "Will be tradable in: [x]" distinctly.
export function deriveMockTradingAccount(userWallet: `0x${string}`): `0x${string}` {
  const hash = keccak256(toBytes(`mock-hyperliquid:${userWallet.toLowerCase()}`));
  return getAddress(`0x${hash.slice(-40)}`);
}

export function isHyperliquidCredited(confirmedOnchainAt: string): boolean {
  const elapsed = Date.now() - new Date(confirmedOnchainAt).getTime();
  return elapsed >= BRIDGING_DELAY_MS.min;
}

export const HYPERLIQUID_MOCK_WINDOW_MS = BRIDGING_DELAY_MS;
