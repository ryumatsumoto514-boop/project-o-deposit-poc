import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s · Exchange O",
    default: "Approve & sign",
  },
};

export default function ApproveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
