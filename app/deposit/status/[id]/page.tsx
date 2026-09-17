"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KolBanner } from "../../../components/KolBanner";
import { WalletRoles } from "../../../components/WalletRoles";
import type { DepositRecord, DepositStatus } from "@/lib/types";
import { ARBISCAN_SEPOLIA_TX_URL } from "@/lib/chain";

const HAPPY_PATH: DepositStatus[] = [
  "SIGNED",
  "CONFIRMED_ONCHAIN",
  "BRIDGING",
  "CREDITED",
];

const STATE_COPY: Record<DepositStatus, { label: string; description: string }> = {
  SIGNED: {
    label: "Signed — broadcasting",
    description: "Your approval was signed. Starting the deposit transfer now.",
  },
  CONFIRMED_ONCHAIN: {
    label: "Confirmed on Arbitrum",
    description: "The deposit transaction is confirmed on Arbitrum Sepolia.",
  },
  BRIDGING: {
    label: "Moving to your trading account",
    description:
      "Your funds are confirmed on-chain and are being credited as tradable collateral. This mock step usually takes 15–30 seconds.",
  },
  CREDITED: {
    label: "Credited — tradable now",
    description:
      "Both the on-chain transaction and the (mocked) Hyperliquid balance check agree: your funds are tradable.",
  },
  STALLED_NO_GAS: {
    label: "Stalled — gas issue",
    description:
      "A step in the pipeline couldn't proceed because a wallet involved didn't have enough ETH for gas.",
  },
  STALLED_TIMEOUT: {
    label: "Taking longer than expected",
    description:
      "This deposit has been in progress longer than usual. We're still tracking it — no need to send another deposit.",
  },
  AMBIGUOUS: {
    label: "Needs reconciliation",
    description:
      "Arbitrum says this deposit is confirmed, but the (mocked) Hyperliquid balance check hasn't agreed within the expected window. We've flagged this for review instead of guessing.",
  },
};

const ACTIVE_STATUSES: DepositStatus[] = ["SIGNED", "CONFIRMED_ONCHAIN", "BRIDGING"];
const SLOW_POLL_STATUSES: DepositStatus[] = [
  "AMBIGUOUS",
  "STALLED_TIMEOUT",
  "STALLED_NO_GAS",
];

function Stepper({ status }: { status: DepositStatus }) {
  const isException = !HAPPY_PATH.includes(status);
  const currentIndex = isException ? -1 : HAPPY_PATH.indexOf(status);

  return (
    <div className="flex flex-col gap-0">
      {HAPPY_PATH.map((s, i) => {
        const done = !isException && i < currentIndex;
        const active = !isException && i === currentIndex;
        return (
          <div key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                  done
                    ? "border-green-600 bg-green-600 text-white"
                    : active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-neutral-300 bg-white text-neutral-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              {i < HAPPY_PATH.length - 1 && (
                <div className="h-8 w-px bg-neutral-200" />
              )}
            </div>
            <div className="pb-6 pt-0.5">
              <p
                className={`text-sm font-medium ${
                  active ? "text-blue-700" : done ? "text-green-700" : "text-neutral-400"
                }`}
              >
                {STATE_COPY[s].label}
              </p>
              {active && (
                <p className="mt-1 text-xs text-neutral-500">{STATE_COPY[s].description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DepositStatusPage({ params }: { params: { id: string } }) {
  const [deposit, setDeposit] = useState<DepositRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const pollDelay = useRef(3000);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const res = await fetch(`/api/deposits/${params.id}/reconcile`, {
          method: "POST",
        });
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const body = await res.json();
        if (cancelled) return;
        setDeposit(body.deposit);

        pollDelay.current = SLOW_POLL_STATUSES.includes(body.deposit.status)
          ? 8000
          : 3000;

        if (body.deposit.status !== "CREDITED") {
          timer = setTimeout(tick, pollDelay.current);
        }
      } catch {
        if (!cancelled) timer = setTimeout(tick, pollDelay.current);
      }
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [params.id]);

  if (notFound) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
        <h1 className="text-lg font-semibold">Deposit not found</h1>
        <p className="text-sm text-neutral-600">
          No deposit with id <code>{params.id}</code> exists. It may have
          been cleared (this PoC uses a local file store — see README).
        </p>
        <Link href="/deposit" className="text-sm text-blue-600 underline">
          Start a new deposit
        </Link>
      </main>
    );
  }

  if (!deposit) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
        <p className="text-sm text-neutral-500">Loading deposit status…</p>
      </main>
    );
  }

  const isException = !HAPPY_PATH.includes(deposit.status);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <KolBanner />
      <h1 className="text-lg font-semibold">Deposit status</h1>

      <WalletRoles
        fundsFrom={deposit.userWallet}
        tradableIn={deposit.destinationAccount}
      />

      <div className="rounded-md border border-neutral-200 p-3 text-sm">
        <strong>{deposit.amount} USDC</strong> · opened{" "}
        {new Date(deposit.createdAt).toLocaleString()}
      </div>

      {isException && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <strong>{STATE_COPY[deposit.status].label}.</strong>{" "}
          {deposit.failureReason ?? STATE_COPY[deposit.status].description}
        </div>
      )}

      {deposit.status === "CREDITED" && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900">
          <strong>Credited — tradable now.</strong>{" "}
          {STATE_COPY.CREDITED.description}
        </div>
      )}

      <Stepper status={deposit.status} />

      <div className="rounded-md border border-purple-300 bg-purple-50 px-4 py-3 text-sm text-purple-900">
        <strong>Mocked for this PoC:</strong> the Hyperliquid-side balance
        check above is simulated (no real Hyperliquid testnet access). The
        Arbitrum Sepolia transaction below is real.
      </div>

      {deposit.approveTxHash && (
        <div className="flex flex-col gap-1 rounded-md border border-neutral-200 p-3 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Approval transaction (step 1 of 2)
          </span>
          <span className="break-all font-mono text-xs">{deposit.approveTxHash}</span>
          <a
            href={ARBISCAN_SEPOLIA_TX_URL(deposit.approveTxHash)}
            target="_blank"
            rel="noreferrer"
            className="w-fit text-sm text-blue-600 underline"
          >
            View on Arbiscan Sepolia
          </a>
        </div>
      )}

      {deposit.txHash && (
        <div className="flex flex-col gap-1 rounded-md border border-neutral-200 p-3 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Deposit transfer transaction (step 2 of 2)
          </span>
          <span className="break-all font-mono text-xs">{deposit.txHash}</span>
          {deposit.explorerUrl && (
            <a
              href={deposit.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="w-fit text-sm text-blue-600 underline"
            >
              View on Arbiscan Sepolia
            </a>
          )}
        </div>
      )}

      {ACTIVE_STATUSES.includes(deposit.status) && (
        <p className="text-xs text-neutral-400">Checking every few seconds…</p>
      )}
    </main>
  );
}
