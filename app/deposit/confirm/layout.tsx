import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s · Exchange O",
    default: "Confirm address",
  },
  description:
    "Review the full destination account address before continuing with this Arbitrum Sepolia testnet deposit.",
  openGraph: {
    title: "Confirm address · Exchange O",
    description:
      "Review the full destination account address before continuing with this Arbitrum Sepolia testnet deposit.",
    images: ["/opengraph-image"],
  },
  twitter: {
    title: "Confirm address · Exchange O",
    description:
      "Review the full destination account address before continuing with this Arbitrum Sepolia testnet deposit.",
    images: ["/opengraph-image"],
  },
};

export default function ConfirmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
