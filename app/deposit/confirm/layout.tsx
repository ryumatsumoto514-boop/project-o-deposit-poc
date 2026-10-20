import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s · Exchange O",
    default: "Confirm address",
  },
  openGraph: { title: "Confirm address" },
  twitter: { title: "Confirm address" },
};

export default function ConfirmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
