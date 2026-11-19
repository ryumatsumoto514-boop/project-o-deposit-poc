import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Choose a simulated sign-in method or connect a wallet to explore the Arbitrum Sepolia deposit demo.",
  openGraph: {
    title: "Sign in",
    description:
      "Choose a simulated sign-in method or connect a wallet to explore the Arbitrum Sepolia deposit demo.",
    images: [{ url: "/opengraph-image", alt: "Exchange O — Testnet deposit demo" }],
  },
  twitter: {
    title: "Sign in",
    description:
      "Choose a simulated sign-in method or connect a wallet to explore the Arbitrum Sepolia deposit demo.",
    images: [{ url: "/opengraph-image", alt: "Exchange O — Testnet deposit demo" }],
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
