import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deposit status",
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
