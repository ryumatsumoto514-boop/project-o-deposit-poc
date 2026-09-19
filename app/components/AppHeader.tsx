"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { Brand } from "./Brand";
import { truncateAddress } from "@/lib/format";

// Polls the real Arbitrum Sepolia gas price via /api/gas (a genuine RPC
// read, not a fabricated number) — a trading-terminal nav detail. Hidden
// below `sm` so it never competes with the network/wallet pills for space
// on the 375px viewport this app's mobile KOL-referred audience actually
// uses (that exact 3-pill crowding was a real bug fixed in an earlier cycle).
function useGasPriceGwei() {
  const [gwei, setGwei] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/gas");
        if (!res.ok) throw new Error("Gas price request failed");
        const body = await res.json();
        if (!cancelled) setGwei(typeof body.gwei === "number" ? body.gwei : null);
      } catch {
        // A failed refresh cannot substantiate the header's live-price claim.
        if (!cancelled) setGwei(null);
      }
    }
    poll();
    const id = setInterval(poll, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return gwei;
}

export function AppHeader() {
  const { address, isConnected } = useAccount();
  const gwei = useGasPriceGwei();

  return (
    <header className="app-header">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-5">
        <Link href="/" aria-label="Exchange O home" className="min-w-0 shrink">
          <Brand compact={isConnected && !!address} />
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="pill hidden sm:inline-flex"
            title="Live Arbitrum Sepolia gas price, read from RPC"
          >
            <span className="led-dot led-live bg-accent-400 text-accent-400" />
            {gwei !== null ? `${gwei.toFixed(3)} GWEI` : "GAS —"}
          </span>
          <span className="pill">
            <span className="led-dot led-live bg-emerald-400 text-emerald-400" />
            Sepolia
          </span>
          {isConnected && address && (
            <span
              className="pill normal-case font-mono text-slate-300"
              role="group"
              aria-label={`Funding wallet: ${address}`}
              title={`Funding wallet: ${address}`}
            >
              {truncateAddress(address)}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
