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

const FEATURES = [
  { title: "Live status, not a spinner", detail: "Signed → confirmed → bridging → credited, tracked in real time." },
  { title: "Exact-amount approval", detail: "Approve only what you're depositing — never an unlimited allowance by default." },
  { title: "Plain-language failures", detail: "No raw error dumps — every exception tells you what happened and what to do next." },
];

export default function Home() {
  return (
    <main className="page-shell min-h-screen justify-center">
      <Suspense fallback={null}>
        <CaptureKolRef />
      </Suspense>
      <Brand />
      <KolBanner />

      <div className="fade-up flex flex-col gap-4">
        <span className="eyebrow">Deposit reconciliation engine</span>
        <h1 className="h1-hero text-balance">
          Deposit with full visibility, every step of the way.
        </h1>
        <p className="body-text">
          Deposit USDC on Arbitrum and trade on Hyperliquid. This proof of
          concept makes every step of depositing transparent and honest —
          including the parts that are mocked.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/login" className="btn-primary w-fit">
            Get started
          </Link>
          <span className="text-xs text-slate-500">No real funds involved</span>
        </div>
      </div>

      <div className="card-flush fade-up flex flex-col divide-y divide-white/[0.06]" style={{ animationDelay: "80ms" }}>
        {FEATURES.map((f) => (
          <div key={f.title} className="flex flex-col gap-1 p-4">
            <p className="text-sm font-medium text-slate-100">{f.title}</p>
            <p className="text-[13px] leading-relaxed text-slate-500">{f.detail}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-slate-600">
        Arbitrum Sepolia testnet · not real funds
      </p>
    </main>
  );
}
