import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppHeader } from "./components/AppHeader";

// Brand typography per the telemetry-interface design direction: one crisp
// sans for headings/body (Inter), one monospace strictly reserved for
// numeric values, addresses, tx hashes, and status-tag text (JetBrains Mono)
// so anything glanceable-and-precise reads visually distinct from prose.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // Without this, Next.js resolves the OG image route to an absolute URL
  // using a localhost fallback in production — link unfurls on the KOL's
  // actual distribution channels (Twitter/Discord/Slack) would silently
  // show no image at all.
  metadataBase: new URL("https://projecto-blond.vercel.app"),
  title: "Exchange O — Deposit (PoC)",
  description: "Deposit Reconciliation Engine PoC — Arbitrum Sepolia testnet",
  openGraph: {
    type: "website",
    siteName: "Exchange O",
    title: "Exchange O — Testnet deposit demo",
    description:
      "Explore deposit tracking on Arbitrum Sepolia testnet. Email/Google sign-in, bridging, and Hyperliquid crediting are simulated; no real funds are used.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Exchange O — Testnet deposit demo",
    description:
      "Explore deposit tracking on Arbitrum Sepolia testnet. Email/Google sign-in, bridging, and Hyperliquid crediting are simulated; no real funds are used.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0C10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <Providers>
          <AppHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
