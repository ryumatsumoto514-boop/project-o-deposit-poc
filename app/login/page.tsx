"use client";

import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { useFlow } from "../flow-context";
import { KolBanner } from "../components/KolBanner";
import { MockedBadge } from "../components/KolBanner";
import { Brand } from "../components/Brand";

export default function LoginPage() {
  const router = useRouter();
  const { mockIdentity, setMockIdentity } = useFlow();
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();

  function continueTo(identity: string) {
    setMockIdentity(identity);
    router.push("/deposit");
  }

  return (
    <main className="page-shell">
      <Brand />
      <KolBanner />
      <h1 className="h1">Sign in</h1>
      <MockedBadge>
        Email and Google sign-in below are simulated — no real Privy/OAuth
        integration. The wallet you fund from later is a real testnet wallet.
      </MockedBadge>

      {mockIdentity ? (
        <div className="card flex flex-col gap-3">
          <p className="text-sm text-neutral-700">
            Signing in as <strong>{mockIdentity}</strong>
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
            onClick={() => continueTo("demo@exchangeo.test")}
            className="btn-secondary"
          >
            Continue with Email (mock) — demo@exchangeo.test
          </button>
          <button
            onClick={() => continueTo("google:demo.user")}
            className="btn-secondary"
          >
            Continue with Google (mock)
          </button>
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <div className="h-px flex-1 bg-neutral-200" />
            or
            <div className="h-px flex-1 bg-neutral-200" />
          </div>
          {isConnected && address ? (
            <button onClick={() => continueTo(address)} className="btn-secondary min-w-0">
              <span className="min-w-0 truncate">Continue with connected wallet — {address}</span>
            </button>
          ) : (
            connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => connect({ connector })}
                className="btn-secondary"
              >
                Sign in with {connector.name}
              </button>
            ))
          )}
        </div>
      )}
    </main>
  );
}
