import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s · Exchange O",
    default: "Deposit amount",
  },
  openGraph: { title: "Deposit amount" },
  twitter: { title: "Deposit amount" },
};

export default function DepositLayout({ children }: { children: React.ReactNode }) {
  return children;
}
