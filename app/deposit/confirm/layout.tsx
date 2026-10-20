import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s · Exchange O",
    default: "Confirm address",
  },
  openGraph: { title: "Confirm address · Exchange O" },
  twitter: { title: "Confirm address · Exchange O" },
};

export default function ConfirmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
