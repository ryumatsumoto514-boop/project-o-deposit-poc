"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useFlow } from "./flow-context";
import { KolBanner } from "./components/KolBanner";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <Suspense fallback={null}>
        <CaptureKolRef />
      </Suspense>
      <KolBanner />
      <h1 className="text-xl font-semibold">Exchange O</h1>
      <p className="text-sm text-neutral-600">
        Deposit USDC on Arbitrum and trade on Hyperliquid. This is a proof of
        concept focused on making every step of depositing transparent and
        honest — including the parts that are mocked.
      </p>
      <Link
        href="/login"
        className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
      >
        Get started
      </Link>
    </main>
  );
}
