"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { useFlow } from "../flow-context";
import { KolBanner } from "../components/KolBanner";
import { WalletRoles } from "../components/WalletRoles";
import { StepProgress, FlowFooter } from "../components/FlowChrome";
import { deriveMockTradingAccount } from "@/lib/hyperliquidMock";
import { MAX_DEMO_AMOUNT } from "@/lib/constants";

export default function DepositAmountPage() {
  const router = useRouter();
  const { mockIdentity, draftAmount, setDraftAmount, hydrated } = useFlow();
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error: connectionError } = useConnect();
  const [amount, setAmount] = useState(draftAmount || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !mockIdentity) router.replace("/login");
  }, [hydrated, mockIdentity, router]);

  // `draftAmount` only becomes available after FlowProvider's async
  // sessionStorage read resolves (see flow-context.tsx), which happens after
  // this component's first render — so the useState initializer above misses
  // it on a resumed session (refresh, or arriving here with a prior draft
  // already set). Sync once hydration completes so a resumed draft actually
  // shows up in the field instead of silently rendering empty.
  useEffect(() => {
    if (hydrated && draftAmount) setAmount(draftAmount);
  }, [hydrated, draftAmount]);

  if (!hydrated || !mockIdentity) return null;

  const tradableIn = address ? deriveMockTradingAccount(address) : null;

  function handleContinue() {
    // Match the creation API before the user spends gas on an approval.
    if (!/^\d+(?:\.\d{1,6})?$/.test(amount)) {
      setError("Enter a decimal amount with at most 6 decimal places (for example, 10.50).");
      return;
    }
    const parsed = Number(amount);
    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (parsed > MAX_DEMO_AMOUNT) {
      setError(`This demo caps deposits at ${MAX_DEMO_AMOUNT} USDC.`);
      return;
    }
    setDraftAmount(amount);
    router.push("/deposit/confirm");
  }

  return (
    <main className="page-shell">
      <KolBanner />
      <StepProgress step={2} />
      <h1 className="h1">Deposit amount</h1>

      <WalletRoles
        signingInAs={mockIdentity}
        fundsFrom={address ?? null}
        tradableIn={tradableIn}
      />

      {!isConnected && (
        <div className="card flex flex-col gap-3">
          <p className="body-text">
            Connect the wallet you&apos;ll fund this deposit from. This must
            be a real wallet with testnet ETH and USDC on Arbitrum Sepolia.
          </p>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              disabled={isPending}
              aria-busy={isPending}
              className="btn-primary w-fit"
            >
              {isPending ? "Connecting…" : `Connect ${connector.name}`}
            </button>
          ))}
          {connectionError && (
            <p role="alert" className="text-sm text-rose-300">
              Wallet connection did not complete. Open your wallet and try again.
            </p>
          )}
        </div>
      )}

      {isConnected && (
        <form
          className="card flex flex-col gap-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleContinue();
          }}
        >
          <label htmlFor="deposit-amount" className="label-caps">Amount (USDC)</label>
          <div className="relative">
            <input
              id="deposit-amount"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "deposit-amount-error" : undefined}
              type="number"
              min="0"
              step="0.000001"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              placeholder="10.00"
              className="input pr-16 font-mono text-lg [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-slate-500">
              USDC
            </span>
          </div>
          {error && <p id="deposit-amount-error" role="alert" className="text-sm text-rose-400">{error}</p>}
          <button type="submit" className="btn-primary mt-2 w-fit">
            Continue
          </button>
        </form>
      )}
      <FlowFooter />
    </main>
  );
}
