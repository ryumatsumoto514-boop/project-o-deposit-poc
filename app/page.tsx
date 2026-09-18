"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useFlow } from "./flow-context";
import { KolBanner } from "./components/KolBanner";
import { EngineVisual } from "./components/EngineVisual";
import { PipelineStepper } from "./components/PipelineStepper";

function CaptureKolRef() {
  const searchParams = useSearchParams();
  const { setKolRef } = useFlow();
  const ref = searchParams.get("ref");

  useEffect(() => {
    if (ref) setKolRef(ref);
  }, [ref, setKolRef]);

  return null;
}

function StatusTag({
  dot = "accent",
  children,
}: {
  dot?: "accent" | "emerald";
  children: React.ReactNode;
}) {
  const dotClass = dot === "emerald" ? "bg-emerald-400 text-emerald-400" : "bg-accent-400 text-accent-400";
  return (
    <span className="tag">
      <span className={`led-dot led-live ${dotClass}`} />
      {children}
    </span>
  );
}

export default function Home() {
  return (
    <main className="page-shell-wide">
      <Suspense fallback={null}>
        <CaptureKolRef />
      </Suspense>
      <KolBanner />

      {/* Asymmetric hero: high-impact copy + live ticker on the left,
          the O Engine telemetry visual on the right. */}
      <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
        <div className="fade-up flex flex-col gap-5">
          <span className="eyebrow">Deposit reconciliation engine</span>
          <h1 className="h1-hero text-balance">
            Deposit with full visibility, every step of the way.
          </h1>
          <p className="body-text max-w-md">
            Deposit USDC on Arbitrum and trade on Hyperliquid. This proof of
            concept makes every step of depositing transparent and honest —
            including the parts that are mocked.
          </p>

          <div
            className="ticker w-fit flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2"
            title="Illustrative example value — not a live measurement"
          >
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="led-dot led-live bg-accent-400 text-accent-400" />
              ARBITRUM SEPOLIA &rarr; HYPERLIQUID
            </span>
            <span className="hidden text-slate-600 sm:inline">|</span>
            <span className="whitespace-nowrap">
              LATENCY: ~42ms <span className="text-slate-600">(illustrative)</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusTag dot="emerald">Exact-amount approval by default</StatusTag>
            <StatusTag>Real-time exception handling</StatusTag>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/login" className="btn-primary w-fit">
              Get started
            </Link>
            <span className="text-xs text-slate-500">No real funds involved</span>
          </div>
        </div>

        <div className="fade-up" style={{ animationDelay: "80ms" }}>
          <EngineVisual />
        </div>
      </section>

      {/* Live Pipeline Stepper — replaces the old 3 static feature blocks. */}
      <section className="fade-up flex flex-col gap-4" style={{ animationDelay: "140ms" }}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="h1">Live pipeline</h2>
          <span className="label-caps hidden text-slate-600 sm:inline">
            Real-time on the status tracker
          </span>
        </div>
        <PipelineStepper />
      </section>

      <p className="text-center text-xs text-slate-600">
        Arbitrum Sepolia testnet · not real funds
      </p>
    </main>
  );
}
