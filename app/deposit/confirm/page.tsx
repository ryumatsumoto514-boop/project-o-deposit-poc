"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useFlow } from "../../flow-context";
import { KolBanner } from "../../components/KolBanner";
import { WalletRoles } from "../../components/WalletRoles";
import { AlertIcon } from "../../components/icons";
import { StepProgress, FlowFooter, FlowLoading } from "../../components/FlowChrome";
import { deriveMockTradingAccount } from "@/lib/hyperliquidMock";
import { DEPOSIT_ADDRESS } from "@/lib/chain";
import { useDocumentTitle } from "../../useDocumentTitle";

export default function DepositConfirmPage() {
  useDocumentTitle("Confirm address");
  const router = useRouter();
  const { mockIdentity, draftAmount, setAddressConfirmed, hydrated } = useFlow();
  const { address, status: accountStatus } = useAccount();
  const [confirmed, setConfirmed] = useState(false);
  const walletSettling = accountStatus === "connecting" || accountStatus === "reconnecting";

  useEffect(() => {
    if (!hydrated || walletSettling) return;
    if (mockIdentity && draftAmount && address) return;
    // A fresh load (refresh, deep link) races wagmi's async wallet
    // reconnect: `address` can still be empty here even though reconnect
    // is about to succeed. Give it a beat before concluding there's really
    // no wallet, instead of bouncing the user back to step 2 mid-reconnect.
    const timer = setTimeout(() => router.replace("/deposit"), 1500);
    return () => clearTimeout(timer);
  }, [hydrated, walletSettling, mockIdentity, draftAmount, address, router]);

  if (!hydrated || walletSettling || !mockIdentity || !draftAmount || !address) return <FlowLoading />;

  return (
    <main className="page-shell">
      <KolBanner />
      <StepProgress step={3} />
      <h1 className="h1">Confirm destination address</h1>

      <WalletRoles
        signingInAs={mockIdentity}
        fundsFrom={address}
        tradableIn={deriveMockTradingAccount(address)}
      />

      <div className="card flex flex-col gap-2">
        <p className="body-text">
          You&apos;re about to send <strong className="text-slate-200">{draftAmount} USDC</strong> on
          Arbitrum Sepolia to this address:
        </p>
        <p className="mono-box">{DEPOSIT_ADDRESS}</p>
      </div>

      <div className="banner-amber flex items-start gap-2.5">
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <span>
          Double check this matches what you expect — scammers sometimes use
          addresses that look almost identical to a real one. We show the
          full address here, not a shortened version, so you can compare it
          carefully.
        </span>
      </div>

      <label className="card flex items-start gap-2.5 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#00F0FF]"
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
      <FlowFooter />
    </main>
  );
}
