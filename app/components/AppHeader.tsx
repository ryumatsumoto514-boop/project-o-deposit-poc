"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { Brand } from "./Brand";
import { truncateAddress } from "@/lib/format";

export function AppHeader() {
  const { address, isConnected } = useAccount();

  return (
    <header className="app-header">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between gap-3 px-4 sm:px-5">
        <Link href="/" className="min-w-0 shrink">
          <Brand compact={isConnected && !!address} />
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="pill">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            Sepolia
          </span>
          {isConnected && address && (
            <span className="pill font-mono text-slate-300">{truncateAddress(address)}</span>
          )}
        </div>
      </div>
    </header>
  );
}
