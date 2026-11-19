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
    images: ["/opengraph-image"],
  },
  twitter: {
    title: "Deposit status · Exchange O",
    description:
      "Track this deposit's Arbitrum Sepolia confirmation and simulated bridging and tradable-credit status.",
    images: ["/opengraph-image"],
  },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
