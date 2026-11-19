import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s · Exchange O",
    default: "Deposit status",
  },
  description:
    "Track this deposit's Arbitrum Sepolia confirmation and simulated bridging and tradable-credit status.",
  openGraph: {
    title: "Deposit status · Exchange O",
    description:
      "Track this deposit's Arbitrum Sepolia confirmation and simulated bridging and tradable-credit status.",
    images: [{ url: "/opengraph-image", alt: "Exchange O — Testnet deposit demo" }],
  },
  twitter: {
    title: "Deposit status · Exchange O",
    description:
      "Track this deposit's Arbitrum Sepolia confirmation and simulated bridging and tradable-credit status.",
    images: [{ url: "/opengraph-image", alt: "Exchange O — Testnet deposit demo" }],
  },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
