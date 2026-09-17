"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useFlow } from "./flow-context";
import { KolBanner } from "./components/KolBanner";
import { Brand } from "./components/Brand";

function CaptureKolRef() {
  const searchParams = useSearchParams();
  const { setKolRef } = useFlow();
  const ref = searchParams.get("ref");

  useEffect(() => {
    if (ref) setKolRef(ref);
  }, [ref, setKolRef]);

  return null;
}

export default function Home() {
  return (
    <main className="page-shell min-h-screen justify-center">
      <Suspense fallback={null}>
        <CaptureKolRef />
      </Suspense>
      <Brand />
      <KolBanner />
      <div className="card flex flex-col gap-3">
        <h1 className="h1">Deposit with full visibility</h1>
        <p className="text-sm leading-relaxed text-neutral-600">
          Deposit USDC on Arbitrum and trade on Hyperliquid. This proof of
          concept is focused on making every step of depositing transparent
          and honest — including the parts that are mocked.
        </p>
        <Link href="/login" className="btn-primary mt-1 w-fit">
          Get started
        </Link>
      </div>
      <p className="text-center text-xs text-neutral-400">
        Arbitrum Sepolia testnet · not real funds
      </p>
    </main>
  );
}
