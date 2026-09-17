"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KolBanner } from "../../../components/KolBanner";
import { WalletRoles } from "../../../components/WalletRoles";
import { Brand } from "../../../components/Brand";
import { AlertIcon, CheckIcon, SpinnerIcon } from "../../../components/icons";
import type { DepositRecord, DepositStatus } from "@/lib/types";
import { ARBISCAN_SEPOLIA_TX_URL } from "@/lib/chain";

const HAPPY_PATH: DepositStatus[] = [
  "SIGNED",
  "CONFIRMED_ONCHAIN",
  "BRIDGING",
  "CREDITED",
];

type Severity = "warning" | "error";

const STATE_COPY: Record<
  DepositStatus,
  { label: string; description: string; severity?: Severity; nextStep?: string }
> = {
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
    label: "Paused — needs a little ETH",
    description:
      "A step in the pipeline couldn't proceed because a wallet involved didn't have enough ETH for gas. Your USDC is safe and nothing is lost.",
    severity: "warning",
    nextStep: "Top up a small amount of testnet ETH, then this will resume automatically — no need to restart.",
  },
  STALLED_TIMEOUT: {
    label: "Taking longer than expected",
    description:
      "This deposit has been in progress longer than usual. Your funds are not at risk.",
    severity: "warning",
    nextStep: "We're still tracking it in the background — no need to send another deposit or refresh.",
  },
  AMBIGUOUS: {
    label: "Under review",
    description:
      "Arbitrum confirms this deposit, but the (mocked) Hyperliquid balance check hasn't agreed within the expected window.",
    severity: "error",
    nextStep: "We've flagged this for manual reconciliation instead of guessing. Your funds are on-chain and accounted for.",
  },
};

const SEVERITY_STYLE: Record<Severity, { banner: string; icon: string; divider: string }> = {
  warning: { banner: "banner-amber", icon: "text-amber-300", divider: "border-amber-400/20" },
  error: { banner: "banner-red", icon: "text-rose-300", divider: "border-rose-400/20" },
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
    <div className="card flex flex-col gap-0 py-3">
      {HAPPY_PATH.map((s, i) => {
        const done = !isException && i < currentIndex;
        const active = !isException && i === currentIndex;
        return (
          <div key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                  done
                    ? "bg-emerald-500 text-white shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                    : active
                    ? "pulse-ring bg-gradient-to-br from-indigo-400 to-violet-600 text-white"
                    : "border border-white/15 bg-white/[0.03] text-slate-600"
                }`}
              >
                {done ? (
                  <CheckIcon className="h-4 w-4" />
                ) : active ? (
                  <SpinnerIcon className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              {i < HAPPY_PATH.length - 1 && (
                <div
                  className={`h-8 w-px transition-colors duration-300 ${
                    done ? "bg-emerald-500/60" : "bg-white/10"
                  }`}
                />
              )}
            </div>
            <div className="pb-6 pt-0.5">
              <p
                className={`text-sm font-medium transition-colors duration-300 ${
                  active ? "text-indigo-300" : done ? "text-emerald-300" : "text-slate-600"
                }`}
              >
                {STATE_COPY[s].label}
              </p>
              {active && (
                <p className="mt-1 text-xs text-slate-500">{STATE_COPY[s].description}</p>
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
      <main className="page-shell">
        <Brand />
        <h1 className="h1">Deposit not found</h1>
        <p className="body-text">
          No deposit with id <code className="text-slate-300">{params.id}</code> exists. It may have
          been cleared (this PoC uses a local file store — see README).
        </p>
        <Link href="/deposit" className="text-sm">
          Start a new deposit →
        </Link>
      </main>
    );
  }

  if (!deposit) {
    return (
      <main className="page-shell">
        <Brand />
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <SpinnerIcon className="h-4 w-4" /> Loading deposit status…
        </p>
      </main>
    );
  }

  const isException = !HAPPY_PATH.includes(deposit.status);

  if (deposit.status === "CREDITED") {
    return (
      <main className="page-shell min-h-screen justify-center">
        <Brand />
        <div className="success-pop flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_0_8px_rgba(16,185,129,0.1),0_12px_28px_-8px_rgba(16,185,129,0.6)]">
            <CheckIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="h1">Credited — tradable now</h1>
          <p className="body-text max-w-xs">
            <strong className="text-emerald-300">{deposit.amount} USDC</strong> is confirmed
            on-chain and credited to your trading account.
          </p>
        </div>

        <WalletRoles fundsFrom={deposit.userWallet} tradableIn={deposit.destinationAccount} />

        <Stepper status={deposit.status} />

        <div className="banner-purple">
          <strong>Mocked for this PoC:</strong> the Hyperliquid-side balance
          check above is simulated (no real Hyperliquid testnet access). The
          Arbitrum Sepolia transactions below are real.
        </div>

        {deposit.approveTxHash && (
          <div className="card flex flex-col gap-1">
            <span className="label-caps">Approval transaction (step 1 of 2)</span>
            <span className="break-all font-mono text-xs text-slate-400">{deposit.approveTxHash}</span>
            <a href={ARBISCAN_SEPOLIA_TX_URL(deposit.approveTxHash)} target="_blank" rel="noreferrer" className="w-fit text-sm">
              View on Arbiscan Sepolia ↗
            </a>
          </div>
        )}
        {deposit.txHash && (
          <div className="card flex flex-col gap-1">
            <span className="label-caps">Deposit transfer transaction (step 2 of 2)</span>
            <span className="break-all font-mono text-xs text-slate-400">{deposit.txHash}</span>
            {deposit.explorerUrl && (
              <a href={deposit.explorerUrl} target="_blank" rel="noreferrer" className="w-fit text-sm">
                View on Arbiscan Sepolia ↗
              </a>
            )}
          </div>
        )}

        <Link href="/deposit" className="btn-secondary w-fit">
          Start another deposit
        </Link>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <Brand />
      <KolBanner />
      <h1 className="h1">Deposit status</h1>

      <WalletRoles
        fundsFrom={deposit.userWallet}
        tradableIn={deposit.destinationAccount}
      />

      <div className="card text-sm text-slate-300">
        <strong className="text-slate-100">{deposit.amount} USDC</strong> · opened{" "}
        {new Date(deposit.createdAt).toLocaleString()}
      </div>

      {isException && (() => {
        const copy = STATE_COPY[deposit.status];
        const style = SEVERITY_STYLE[copy.severity ?? "error"];
        return (
          <div className={`${style.banner} flex flex-col gap-2`}>
            <div className="flex items-start gap-2.5">
              <AlertIcon className={`mt-0.5 h-4 w-4 shrink-0 ${style.icon}`} />
              <span>
                <strong>{copy.label}.</strong>{" "}
                {deposit.failureReason ?? copy.description}
              </span>
            </div>
            {copy.nextStep && (
              <div className={`flex items-start gap-2.5 border-t ${style.divider} pt-2 text-sm`}>
                <span className="label-caps shrink-0 opacity-70">Next step</span>
                <span>{copy.nextStep}</span>
              </div>
            )}
          </div>
        );
      })()}

      <Stepper status={deposit.status} />

      <div className="banner-purple">
        <strong>Mocked for this PoC:</strong> the Hyperliquid-side balance
        check above is simulated (no real Hyperliquid testnet access). The
        Arbitrum Sepolia transaction below is real.
      </div>

      {deposit.approveTxHash && (
        <div className="card flex flex-col gap-1">
          <span className="label-caps">Approval transaction (step 1 of 2)</span>
          <span className="break-all font-mono text-xs text-slate-400">{deposit.approveTxHash}</span>
          <a
            href={ARBISCAN_SEPOLIA_TX_URL(deposit.approveTxHash)}
            target="_blank"
            rel="noreferrer"
            className="w-fit text-sm"
          >
            View on Arbiscan Sepolia ↗
          </a>
        </div>
      )}

      {deposit.txHash && (
        <div className="card flex flex-col gap-1">
          <span className="label-caps">Deposit transfer transaction (step 2 of 2)</span>
          <span className="break-all font-mono text-xs text-slate-400">{deposit.txHash}</span>
          {deposit.explorerUrl && (
            <a
              href={deposit.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="w-fit text-sm"
            >
              View on Arbiscan Sepolia ↗
            </a>
          )}
        </div>
      )}

      {ACTIVE_STATUSES.includes(deposit.status) && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <SpinnerIcon className="h-3 w-3" /> Checking every few seconds…
        </p>
      )}
    </main>
  );
}
