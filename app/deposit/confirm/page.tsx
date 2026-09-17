"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useFlow } from "../../flow-context";
import { KolBanner } from "../../components/KolBanner";
import { WalletRoles } from "../../components/WalletRoles";
import { Brand } from "../../components/Brand";
import { AlertIcon } from "../../components/icons";
import { deriveMockTradingAccount } from "@/lib/hyperliquidMock";
import { DEPOSIT_ADDRESS } from "@/lib/chain";

export default function DepositConfirmPage() {
  const router = useRouter();
  const { mockIdentity, draftAmount, setAddressConfirmed } = useFlow();
  const { address } = useAccount();
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!mockIdentity || !draftAmount || !address) router.replace("/deposit");
  }, [mockIdentity, draftAmount, address, router]);

  if (!mockIdentity || !draftAmount || !address) return null;

  return (
    <main className="page-shell">
      <Brand />
      <KolBanner />
      <h1 className="h1">Confirm destination address</h1>

      <WalletRoles
        signingInAs={mockIdentity}
        fundsFrom={address}
        tradableIn={deriveMockTradingAccount(address)}
      />

      <div className="card flex flex-col gap-2">
        <p className="text-sm text-neutral-600">
          You&apos;re about to send <strong>{draftAmount} USDC</strong> on
          Arbitrum Sepolia to this address:
        </p>
        <p className="break-all rounded-lg bg-neutral-100 p-3 font-mono text-sm">
          {DEPOSIT_ADDRESS}
        </p>
      </div>

      <div className="banner-amber flex items-start gap-2.5">
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span>
          Double check this matches what you expect — scammers sometimes use
          addresses that look almost identical to a real one. We show the
          full address here, not a shortened version, so you can compare it
          carefully.
        </span>
      </div>

      <label className="card flex items-start gap-2.5 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-blue-600"
        />
        I&apos;ve checked the full address above and it matches what I
        expect.
      </label>

      <button
        onClick={() => {
          setAddressConfirmed(true);
          router.push("/deposit/approve");
        }}
        disabled={!confirmed}
        className="btn-primary w-fit"
      >
        Continue
      </button>
    </main>
  );
}
