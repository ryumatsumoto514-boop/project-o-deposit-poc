import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s · Exchange O",
    default: "Deposit amount",
  },
  openGraph: { title: "Deposit amount · Exchange O" },
  twitter: { title: "Deposit amount · Exchange O" },
};

export default function DepositLayout({ children }: { children: React.ReactNode }) {
  return children;
}
