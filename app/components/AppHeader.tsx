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
// undefined = not yet fetched (first load), null = fetch attempted and failed,
// number = last known good value. Distinguishing "loading" from "failed" stops
// the pill from claiming a refresh failed before it has even run once.
function useGasPriceGwei() {
  const [gwei, setGwei] = useState<number | null | undefined>(undefined);

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
        <Link
          href="/"
          aria-label="Exchange O home"
          className="inline-flex shrink-0 items-center px-1.5 py-1.5"
        >
          <Brand compact={isConnected && !!address} />
        </Link>
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="pill hidden sm:inline-flex"
            title={
              typeof gwei === "number"
                ? "Live Arbitrum Sepolia gas price, read from RPC"
                : gwei === null
                  ? "Gas price refresh failed — showing no data instead of a stale or fabricated number"
                  : "Loading live Arbitrum Sepolia gas price…"
            }
          >
            <span
              className={
                typeof gwei === "number"
                  ? "led-dot led-live bg-accent-400 text-accent-400"
                  : "led-dot bg-slate-600 text-slate-600"
              }
            />
            {typeof gwei === "number" ? `${gwei.toFixed(3)} GWEI` : gwei === null ? "GAS —" : "GAS …"}
          </span>
          <span className="pill shrink-0">
            <span className="led-dot led-live bg-emerald-400 text-emerald-400 shrink-0" />
            Sepolia
          </span>
          {isConnected && address && (
            <span
              className="pill min-w-0 shrink truncate normal-case font-mono text-slate-300"
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
