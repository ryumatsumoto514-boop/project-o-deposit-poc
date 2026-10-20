import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s · Exchange O",
    default: "Deposit status",
  },
  openGraph: { title: "Deposit status · Exchange O" },
  twitter: { title: "Deposit status · Exchange O" },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
