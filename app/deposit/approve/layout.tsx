import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s · Exchange O",
    default: "Approve & sign",
  },
  description:
    "Review the requested MockUSDC approval amount and sign the testnet deposit transaction.",
  openGraph: {
    title: "Approve & sign · Exchange O",
    description:
      "Review the requested MockUSDC approval amount and sign the testnet deposit transaction.",
  },
  twitter: {
    title: "Approve & sign · Exchange O",
    description:
      "Review the requested MockUSDC approval amount and sign the testnet deposit transaction.",
  },
};

export default function ApproveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
