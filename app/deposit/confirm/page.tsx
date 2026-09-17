"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useFlow } from "../../flow-context";
import { KolBanner } from "../../components/KolBanner";
import { WalletRoles } from "../../components/WalletRoles";
import { deriveMockTradingAccount } from "@/lib/hyperliquidMock";
import { DEPOSIT_ADDRESS } from "@/lib/chain";

export default function DepositConfirmPage() {
  const router = useRouter();
  const { mockIdentity, draftAmount } = useFlow();
  const { address } = useAccount();
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!mockIdentity || !draftAmount || !address) router.replace("/deposit");
  }, [mockIdentity, draftAmount, address, router]);

  if (!mockIdentity || !draftAmount || !address) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <KolBanner />
      <h1 className="text-lg font-semibold">Confirm destination address</h1>

      <WalletRoles
        signingInAs={mockIdentity}
        fundsFrom={address}
        tradableIn={deriveMockTradingAccount(address)}
      />

      <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
        <p className="text-sm text-neutral-600">
          You&apos;re about to send <strong>{draftAmount} USDC</strong> on
          Arbitrum Sepolia to this address:
        </p>
        <p className="break-all rounded-md bg-neutral-100 p-3 font-mono text-sm">
          {DEPOSIT_ADDRESS}
        </p>
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Double check this matches what you expect — scammers sometimes use
        addresses that look almost identical to a real one. We show the full
        address here, not a shortened version, so you can compare it
        carefully.
      </div>

      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1"
        />
        I&apos;ve checked the full address above and it matches what I
        expect.
      </label>

      <button
        onClick={() => router.push("/deposit/approve")}
        disabled={!confirmed}
        className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        Continue
      </button>
    </main>
  );
}
