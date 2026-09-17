// Plain-language failure classification (UX improvement #2). Copy assumes
// zero crypto background — no "gas", "bridge", or "contract" without a
// plain-English explanation attached.

export type FailureCode = "NO_GAS" | "SLOW" | "UNKNOWN";

export const FAILURE_COPY: Record<FailureCode, { title: string; detail: string }> = {
  NO_GAS: {
    title: "You don't have enough ETH on Arbitrum to pay the network fee",
    detail:
      "Every transaction on Arbitrum needs a small amount of ETH to process, separate from the USDC you're depositing. Get a small amount of free testnet ETH from a faucet, then try again.",
  },
  SLOW: {
    title: "This is taking longer than usual",
    detail:
      "Your deposit was confirmed, but moving it into your tradable balance is taking longer than expected. This can happen during network congestion. We're still tracking it — no need to send another deposit.",
  },
  UNKNOWN: {
    title: "Something went wrong",
    detail:
      "We couldn't complete this step. Your funds have not left your wallet unless a transaction hash is shown below. Please try again, or contact support with your deposit ID.",
  },
};
