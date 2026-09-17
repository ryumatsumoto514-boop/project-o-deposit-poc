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
  const { mockIdentity, draftAmount, setDraftAmount } = useFlow();
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const [amount, setAmount] = useState(draftAmount || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mockIdentity) router.replace("/login");
  }, [mockIdentity, router]);

  if (!mockIdentity) return null;

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <KolBanner />
      <h1 className="text-lg font-semibold">Deposit amount</h1>

      <WalletRoles
        signingInAs={mockIdentity}
        fundsFrom={address ?? null}
        tradableIn={tradableIn}
      />

      {!isConnected && (
        <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
          <p className="text-sm text-neutral-600">
            Connect the wallet you&apos;ll fund this deposit from. This must
            be a real wallet with testnet ETH and USDC on Arbitrum Sepolia.
          </p>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Connect {connector.name}
            </button>
          ))}
        </div>
      )}

      {isConnected && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-neutral-700">
            Amount (USDC)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            placeholder="10.00"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleContinue}
            className="mt-2 w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Continue
          </button>
        </div>
      )}
    </main>
  );
}
