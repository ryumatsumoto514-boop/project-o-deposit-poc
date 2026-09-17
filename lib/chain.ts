import { arbitrumSepolia } from "viem/chains";
import { createPublicClient, http } from "viem";

export const CHAIN = arbitrumSepolia; // chainId 421614

// Official Circle testnet USDC exists at this address on Arbitrum Sepolia,
// but faucet.circle.com's public drip UI returned 404 for the unauthenticated
// endpoint overnight (it now requires a Circle API key we don't have), and
// neither the relayer nor the test wallet had any pre-existing testnet USDC
// balance to test with. So this PoC uses a self-deployed MockUSDC instead —
// identical approve()/transferFrom()/balanceOf() semantics, 6 decimals,
// deployed live to Arbitrum Sepolia by the relayer wallet. See
// testnet-evidence.md for the deploy tx + the real approve()+transferFrom()
// proof transactions. To switch back to real Circle USDC once a faucet key
// is available, just change this constant.
export const USDC_ADDRESS: `0x${string}` =
  "0x950A2C07CD9d6489691625272a8f9f4df4D0342C"; // MockUSDC (PoC testnet only)

export const USDC_DECIMALS = 6;

export const ARBISCAN_SEPOLIA_TX_URL = (hash: string) =>
  `https://sepolia.arbiscan.io/tx/${hash}`;

export const ARBISCAN_SEPOLIA_ADDRESS_URL = (address: string) =>
  `https://sepolia.arbiscan.io/address/${address}`;

// The "deposit contract" address — a testnet-only relayer EOA (see
// lib/relayer.ts) that receives the real approve() + transferFrom(). This is
// the address the address-confirmation screen shows in full.
export const DEPOSIT_ADDRESS = process.env
  .NEXT_PUBLIC_DEPOSIT_ADDRESS as `0x${string}`;

const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL || undefined;

// Minimal ERC-20 ABI: only what the deposit flow needs.
export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

// Server-side read client (used by the reconciliation engine to verify
// tx status independently of whatever the client reports).
export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});
