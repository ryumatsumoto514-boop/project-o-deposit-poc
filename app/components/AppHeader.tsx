"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { Brand } from "./Brand";

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function AppHeader() {
  const { address, isConnected } = useAccount();

  return (
    <header className="app-header">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-5">
        <Link href="/" className="shrink-0">
          <Brand />
        </Link>
        <div className="flex items-center gap-2">
          <span className="pill">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Arbitrum Sepolia
          </span>
          {isConnected && address && (
            <span className="pill font-mono text-slate-300">{truncate(address)}</span>
          )}
        </div>
      </div>
    </header>
  );
}
