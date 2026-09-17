"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { useFlow } from "../flow-context";
import { KolBanner } from "../components/KolBanner";
import { WalletRoles } from "../components/WalletRoles";
import { deriveMockTradingAccount } from "@/lib/hyperliquidMock";

const MAX_DEMO_AMOUNT = 1000;

export default function DepositAmountPage() {
  const router = useRouter();
  const { mockIdentity, draftAmount, setDraftAmount, hydrated } = useFlow();
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const [amount, setAmount] = useState(draftAmount || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !mockIdentity) router.replace("/login");
  }, [hydrated, mockIdentity, router]);

  if (!hydrated || !mockIdentity) return null;

  const tradableIn = address ? deriveMockTradingAccount(address) : null;

  function handleContinue() {
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
              className="btn-primary w-fit"
            >
              Connect {connector.name}
            </button>
          ))}
        </div>
      )}

      {isConnected && (
        <div className="card flex flex-col gap-2">
          <label className="label-caps">Amount (USDC)</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
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
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button onClick={handleContinue} className="btn-primary mt-2 w-fit">
            Continue
          </button>
        </div>
      )}
    </main>
  );
}
