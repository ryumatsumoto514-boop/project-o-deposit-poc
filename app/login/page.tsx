"use client";

import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { useFlow } from "../flow-context";
import { KolBanner } from "../components/KolBanner";
import { MockedBadge } from "../components/KolBanner";
import { GoogleIcon, MailIcon, WalletIcon } from "../components/icons";
import { StepProgress, FlowFooter } from "../components/FlowChrome";

export default function LoginPage() {
  const router = useRouter();
  const { mockIdentity, setMockIdentity } = useFlow();
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();

  function continueTo(identity: string) {
    setMockIdentity(identity);
    router.push("/deposit");
  }

  return (
    <main className="page-shell">
      <KolBanner />
      <StepProgress step={1} />
      <h1 className="h1">Sign in</h1>
      <MockedBadge>
        Email and Google sign-in below are simulated — no real Privy/OAuth
        integration. The wallet you fund from later is a real testnet wallet.
      </MockedBadge>

      {mockIdentity ? (
        <div className="card flex flex-col gap-3">
          <p className="text-sm text-slate-300">
            Signing in as <strong className="text-slate-100">{mockIdentity}</strong>
          </p>
          <button
            onClick={() => router.push("/deposit")}
            className="btn-primary w-fit"
          >
            Continue to deposit
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => continueTo("google:demo.user")}
            className="btn-secondary"
          >
            <GoogleIcon className="h-[18px] w-[18px] shrink-0" />
            Continue with Google
            <span className="ml-auto text-xs font-normal text-slate-400">mock</span>
          </button>
          <button
            onClick={() => continueTo("demo@exchangeo.test")}
            className="btn-secondary"
          >
            <MailIcon className="h-[18px] w-[18px] shrink-0 text-slate-400" />
            Continue with Email
            <span className="ml-auto text-xs font-normal text-slate-400">mock</span>
          </button>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <div className="h-px flex-1 bg-white/10" />
            or
            <div className="h-px flex-1 bg-white/10" />
          </div>
          {isConnected && address ? (
            <button onClick={() => continueTo(address)} className="btn-secondary min-w-0">
              <WalletIcon className="h-[18px] w-[18px] shrink-0 text-slate-400" />
              <span className="min-w-0 truncate">Continue with connected wallet — {address}</span>
            </button>
          ) : (
            connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => connect({ connector })}
                disabled={isPending}
                aria-busy={isPending}
                className="btn-secondary"
              >
                <WalletIcon className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                {isPending ? "Connecting…" : `Sign in with ${connector.name}`}
              </button>
            ))
          )}
          {error && !isConnected && (
            <p role="alert" className="text-sm text-red-400">
              Wallet connection did not complete. Open your wallet and try again,
              or continue with a simulated email or Google sign-in.
            </p>
          )}
        </div>
      )}
      <FlowFooter />
    </main>
  );
}
