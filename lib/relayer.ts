import "server-only";
import { createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN, DEPOSIT_ADDRESS, ERC20_ABI, USDC_ADDRESS } from "./chain";

// Server-only. Simulates "the deposit contract" pulling the user's approved
// USDC into the deposit address via a real transferFrom() call, signed by a
// testnet-only relayer wallet (holds no real value, funded with gas-only
// Arbitrum Sepolia ETH). This is the second half of the preferred
// approve() + transferFrom() pattern from SPEC.md.

const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL || undefined;

function getRelayerAccount() {
  const key = process.env.ARBITRUM_RELAYER_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "ARBITRUM_RELAYER_PRIVATE_KEY is not set — see .env.example"
    );
  }
  return privateKeyToAccount(key as `0x${string}`);
}

export async function pullDeposit(
  userWallet: `0x${string}`,
  amountRaw: bigint
): Promise<Hash> {
  const account = getRelayerAccount();
  const walletClient = createWalletClient({
    account,
    chain: CHAIN,
    transport: http(RPC_URL),
  });

  return walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "transferFrom",
    args: [userWallet, DEPOSIT_ADDRESS, amountRaw],
  });
}
