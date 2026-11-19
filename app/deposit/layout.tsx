import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s · Exchange O",
    default: "Deposit amount",
  },
  description:
    "Enter a testnet MockUSDC amount and review the funding and destination accounts for this deposit demo.",
  openGraph: {
    title: "Deposit amount",
    description:
      "Enter a testnet MockUSDC amount and review the funding and destination accounts for this deposit demo.",
  },
  twitter: {
    title: "Deposit amount",
    description:
      "Enter a testnet MockUSDC amount and review the funding and destination accounts for this deposit demo.",
  },
};

export default function DepositLayout({ children }: { children: React.ReactNode }) {
  return children;
}
