// MOCK Hyperliquid-side balance check. We do not have real Hyperliquid
// testnet access, so this simulates the "collateral credited and tradable"
// signal that the reconciliation engine cross-checks against on-chain state.
// This MUST stay clearly labeled as mocked in the UI and README.

import { keccak256, toBytes, getAddress } from "viem";

const BRIDGING_DELAY_MS = { min: 15_000, max: 30_000 };

// Real bridges occasionally lag well past their normal window — that's
// exactly the case reconcile.ts's AMBIGUOUS_THRESHOLD_MS (60s) exists to
// catch. Without this, every deposit always credits at BRIDGING_DELAY_MS.min
// (15s), which is less than the 60s threshold, so AMBIGUOUS could never
// actually be reached: dead code in reconcile.ts despite being a documented,
// required state. ~1 in 8 deposits (deterministic per deposit id, not random
// per call, so polling doesn't flip the answer) instead simulate a stuck
// bridge that clears at 90s — past the AMBIGUOUS threshold, so it's visibly
// flagged, then self-heals to CREDITED, matching the "recoverable side-state"
// comment in stateMachine.ts.
const SLOW_BRIDGE_DELAY_MS = 90_000;

// There is no real Hyperliquid testnet account here — this deterministically
// derives a plausible-looking mock trading-account address per user wallet
// purely so the UI can label "Will be tradable in: [x]" distinctly.
export function deriveMockTradingAccount(userWallet: `0x${string}`): `0x${string}` {
  const hash = keccak256(toBytes(`mock-hyperliquid:${userWallet.toLowerCase()}`));
  return getAddress(`0x${hash.slice(-40)}`);
}

function isSlowBridgeDeposit(depositId: string): boolean {
  const hash = keccak256(toBytes(`mock-hyperliquid-lag:${depositId}`));
  return parseInt(hash.slice(2, 4), 16) % 8 === 0;
}

export function isHyperliquidCredited(confirmedOnchainAt: string, depositId: string): boolean {
  const elapsed = Date.now() - new Date(confirmedOnchainAt).getTime();
  const delay = isSlowBridgeDeposit(depositId) ? SLOW_BRIDGE_DELAY_MS : BRIDGING_DELAY_MS.min;
  return elapsed >= delay;
}

export const HYPERLIQUID_MOCK_WINDOW_MS = BRIDGING_DELAY_MS;
