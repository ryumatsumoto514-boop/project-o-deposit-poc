"use client";

import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { useFlow } from "../flow-context";
import { KolBanner } from "../components/KolBanner";
import { MockedBadge } from "../components/KolBanner";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <KolBanner />
      <h1 className="text-lg font-semibold">Sign in</h1>
      <MockedBadge>
        Email and Google sign-in below are simulated — no real Privy/OAuth
        integration. The wallet you fund from later is a real testnet wallet.
      </MockedBadge>

      {mockIdentity ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-700">
            Signing in as <strong>{mockIdentity}</strong>
          </p>
          <button
            onClick={() => router.push("/deposit")}
            className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Continue to deposit
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => continueTo("demo@exchangeo.test")}
            className="rounded-md border border-neutral-300 px-4 py-2 text-left text-sm"
          >
            Continue with Email (mock) — demo@exchangeo.test
          </button>
          <button
            onClick={() => continueTo("google:demo.user")}
            className="rounded-md border border-neutral-300 px-4 py-2 text-left text-sm"
          >
            Continue with Google (mock)
          </button>
          <div className="text-center text-xs text-neutral-400">or</div>
          {isConnected && address ? (
            <button
              onClick={() => continueTo(address)}
              className="rounded-md border border-neutral-300 px-4 py-2 text-left text-sm"
            >
              Continue with connected wallet — {address}
            </button>
          ) : (
            connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => connect({ connector })}
                className="rounded-md border border-neutral-300 px-4 py-2 text-left text-sm"
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
