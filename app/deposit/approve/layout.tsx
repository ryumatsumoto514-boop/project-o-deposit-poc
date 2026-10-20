import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s · Exchange O",
    default: "Approve & sign",
  },
  openGraph: { title: "Approve & sign · Exchange O" },
  twitter: { title: "Approve & sign · Exchange O" },
};

export default function ApproveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
