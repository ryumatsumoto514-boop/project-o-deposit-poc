"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useFlow } from "../../flow-context";
import { KolBanner } from "../../components/KolBanner";
import { WalletRoles } from "../../components/WalletRoles";
import { AlertIcon, CheckIcon, CopyIcon } from "../../components/icons";
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
  const [copied, setCopied] = useState(false);
  const walletSettling = accountStatus === "connecting" || accountStatus === "reconnecting";

  async function handleCopyAddress() {
    try {
      await navigator.clipboard.writeText(DEPOSIT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied or unavailable — the address is still
      // fully visible and selectable in the mono-box above, so this is a
      // convenience fallback, not the only way to get the address.
    }
  }

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
        <div className="flex items-start gap-2">
          <p className="mono-box flex-1">{DEPOSIT_ADDRESS}</p>
          <button
            type="button"
            onClick={handleCopyAddress}
            className="btn-secondary flex shrink-0 items-center gap-1.5 self-start"
            aria-label="Copy destination address"
          >
            {copied ? (
              <>
                <CheckIcon className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <CopyIcon className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
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
