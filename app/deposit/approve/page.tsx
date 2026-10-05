"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useBalance, useSwitchChain } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { parseUnits, maxUint256, formatEther, parseEther } from "viem";
import { useFlow } from "../../flow-context";
import { KolBanner } from "../../components/KolBanner";
import { WalletRoles } from "../../components/WalletRoles";
import { AlertIcon, SpinnerIcon } from "../../components/icons";
import { StepProgress, FlowFooter, FlowLoading } from "../../components/FlowChrome";
import { deriveMockTradingAccount } from "@/lib/hyperliquidMock";
import { CHAIN, DEPOSIT_ADDRESS, ERC20_ABI, USDC_ADDRESS, USDC_DECIMALS } from "@/lib/chain";
import { wagmiConfig } from "@/lib/wagmiConfig";
import { FAILURE_COPY } from "@/lib/failures";
import { useDocumentTitle } from "../../useDocumentTitle";
import type { DepositRecord } from "@/lib/types";

const MIN_GAS_WEI = parseEther("0.0001");

type Step =
  | "form"
  | "checking"
  | "awaiting-signature"
  | "confirming-approval"
  | "pulling"
  | "done"
  | "error"
  | "blocked";

const PROGRESS_COPY: Partial<Record<Step, string>> = {
  checking: "Checking for existing deposits…",
  "awaiting-signature": "Waiting for your signature…",
  "confirming-approval": "Confirming approval on-chain…",
  pulling: "Starting deposit transfer…",
  done: "Done",
};

export default function DepositApprovePage() {
  useDocumentTitle("Approve");
  const router = useRouter();
  const { mockIdentity, draftAmount, addressConfirmed, kolRef, approvalMode, setApprovalMode, hydrated } =
    useFlow();
  const { address, chainId, status: accountStatus } = useAccount();
  const {
    data: ethBalance,
    isLoading: gasCheckLoading,
    isError: gasCheckFailed,
    refetch: refetchGasCheck,
  } = useBalance({ address, chainId: CHAIN.id });
  const { switchChain, isPending: isSwitchingChain, error: switchChainError } = useSwitchChain();
  const walletSettling = accountStatus === "connecting" || accountStatus === "reconnecting";

  const [step, setStep] = useState<Step>("form");
  const [errorMessage, setErrorMessage] = useState<{ title: string; detail: string } | null>(null);
  const [blockedDeposit, setBlockedDeposit] = useState<DepositRecord | null>(null);
  const [orphanedDepositId, setOrphanedDepositId] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || walletSettling) return;
    if (mockIdentity && draftAmount && address) {
      if (!addressConfirmed) router.replace("/deposit/confirm");
      return;
    }
    // A fresh load (refresh, deep link) races wagmi's async wallet
    // reconnect: `address` can still be empty here even though reconnect
    // is about to succeed. Give it a beat before concluding there's really
    // no wallet, instead of bouncing the user back to step 2 mid-reconnect.
    const timer = setTimeout(() => router.replace("/deposit"), 1500);
    return () => clearTimeout(timer);
  }, [hydrated, walletSettling, mockIdentity, draftAmount, address, addressConfirmed, router]);

  if (!hydrated || walletSettling || !mockIdentity || !draftAmount || !address || !addressConfirmed) return <FlowLoading />;

  const lowGas = ethBalance !== undefined && ethBalance.value < MIN_GAS_WEI;
  const wrongNetwork = chainId !== undefined && chainId !== CHAIN.id;

  async function handleApproveAndDeposit() {
    if (!address) return;
    if (wrongNetwork) {
      setErrorMessage({
        title: "Your wallet is on the wrong network",
        detail: "Switch to Arbitrum Sepolia before continuing — see the banner above.",
      });
      setStep("error");
      return;
    }
    setErrorMessage(null);
    setOrphanedDepositId(null);
    setStep("checking");
    let createdDepositId: string | null = null;

    try {
      const checkRes = await fetch(
        `/api/deposits/check?wallet=${address}&amount=${draftAmount}`
      );
      if (!checkRes.ok) {
        setErrorMessage({
          title: "Couldn't check for an existing deposit",
          detail: "No approval was requested. Try again once the deposit check is available.",
        });
        setStep("error");
        return;
      }
      const checkBody = await checkRes.json();
      if (checkBody.conflict) {
        setBlockedDeposit(checkBody.conflict);
        setStep("blocked");
        return;
      }

      const amountRaw = parseUnits(draftAmount, USDC_DECIMALS);

      setStep("awaiting-signature");
      const approveTxHash = await writeContract(wagmiConfig, {
        // The wallet may change while the duplicate check is in flight.
        // Sign for the same account/network that the deposit record uses.
        account: address,
        chainId: CHAIN.id,
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [DEPOSIT_ADDRESS, approvalMode === "exact" ? amountRaw : maxUint256],
      });

      const createRes = await fetch("/api/deposits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mockIdentity,
          userWallet: address,
          destinationAccount: deriveMockTradingAccount(address),
          amount: draftAmount,
          amountRaw: amountRaw.toString(),
          sourceChainId: CHAIN.id,
          kolRef,
          approvalMode,
          approveTxHash,
        }),
      });
      const createBody = await createRes.json();
      if (createRes.status === 409) {
        setBlockedDeposit(createBody.deposit);
        setStep("blocked");
        return;
      }
      if (!createRes.ok) throw new Error(createBody.error ?? "CREATE_FAILED");
      const deposit: DepositRecord = createBody.deposit;
      createdDepositId = deposit.id;

      setStep("confirming-approval");
      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        chainId: CHAIN.id,
        hash: approveTxHash,
      });
      if (receipt.status !== "success") {
        const approvalFailure = {
          title: "The approval transaction reverted",
          detail: "The token approval did not complete, so this attempt has not started a deposit transfer. A network fee may still have been charged. Check the transaction in your wallet before trying again.",
        };
        await fetch(`/api/deposits/${deposit.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: "STALLED_TIMEOUT",
            failureReason: `${approvalFailure.title}. ${approvalFailure.detail}`,
          }),
        });
        setErrorMessage(approvalFailure);
        setOrphanedDepositId(deposit.id);
        setStep("error");
        return;
      }

      setStep("pulling");
      const pullRes = await fetch(`/api/deposits/${deposit.id}/pull`, {
        method: "POST",
      });
      if (!pullRes.ok) {
        setErrorMessage({
          title: "The deposit transfer couldn't be started",
          detail:
            "Your approval went through, but we couldn't pull the funds yet. You can check its status — we'll keep retrying automatically.",
        });
      }

      setStep("done");
      router.push(`/deposit/status/${deposit.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/insufficient funds|gas required exceeds/i.test(message)) {
        setErrorMessage(FAILURE_COPY.NO_GAS);
      } else if (/user rejected|denied transaction/i.test(message)) {
        setErrorMessage({
          title: "You cancelled the signature request",
          detail: "No transaction was sent and no funds moved. You can try again whenever you're ready.",
        });
      } else {
        setErrorMessage({
          title: "We couldn't confirm the outcome",
          detail: "An approval or deposit transaction may already have been sent. Check your wallet activity and any existing deposit status before trying again. A missing transaction hash on this screen does not mean no transaction occurred.",
        });
      }
      if (createdDepositId) setOrphanedDepositId(createdDepositId);
      setStep("error");
    }
  }

  const isBusy = step !== "form" && step !== "error";

  if (step === "blocked" && blockedDeposit) {
    return (
      <main className="page-shell">
        <KolBanner />
        <StepProgress step={4} />
        <h1 className="h1">Deposit already in progress</h1>
        <div className="banner-amber flex items-start gap-2.5">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            You already have a deposit in progress for this amount, opened at{" "}
            {new Date(blockedDeposit.createdAt).toLocaleString()}. Do not
            send again — here&apos;s its current status.
          </span>
        </div>
        <button
          onClick={() => router.push(`/deposit/status/${blockedDeposit.id}`)}
          className="btn-primary w-fit"
        >
          View deposit status
        </button>
        <FlowFooter />
      </main>
    );
  }

  return (
    <main className="page-shell">
      <KolBanner />
      <StepProgress step={4} />
      <h1 className="h1">Approve + deposit</h1>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {PROGRESS_COPY[step] ?? ""}
      </p>

      <WalletRoles
        signingInAs={mockIdentity}
        fundsFrom={address}
        tradableIn={deriveMockTradingAccount(address)}
      />

      <div className="card text-sm text-slate-300">
        Depositing <strong className="text-slate-100">{draftAmount} USDC</strong> on Arbitrum Sepolia.
      </div>

      {wrongNetwork && (
        <div className="banner-amber flex flex-col gap-2.5">
          <p className="flex items-start gap-2.5">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>
              <strong>Your wallet is connected to a different network.</strong>{" "}
              This deposit only works on Arbitrum Sepolia — switch networks
              before continuing, or the signature request will fail.
            </span>
          </p>
          <button
            onClick={() => switchChain({ chainId: CHAIN.id })}
            disabled={isSwitchingChain}
            className="btn-warning w-fit"
          >
            {isSwitchingChain ? "Switching…" : "Switch to Arbitrum Sepolia"}
          </button>
          {switchChainError && (
            <p role="alert">
              The network switch did not complete. Try again and accept the
              request in your wallet, or select Arbitrum Sepolia manually in
              your wallet before continuing.
            </p>
          )}
        </div>
      )}

      {gasCheckFailed && (
        <div className="banner-amber flex items-start gap-2.5">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            <strong>Couldn&apos;t check your gas balance.</strong> We can&apos;t
            confirm you have enough ETH for network fees right now, so approval
            is paused.{" "}
            <button
              type="button"
              onClick={() => refetchGasCheck()}
              className="underline hover:text-amber-100"
            >
              Try again
            </button>
            .
          </span>
        </div>
      )}

      {lowGas && !gasCheckFailed && (
        <div className="banner-amber flex items-start gap-2.5">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            <strong>{FAILURE_COPY.NO_GAS.title}.</strong> Current balance:{" "}
            {ethBalance ? formatEther(ethBalance.value) : "0"} ETH.{" "}
            {FAILURE_COPY.NO_GAS.detail}{" "}
            <a
              href="https://www.alchemy.com/faucets/arbitrum-sepolia"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-amber-100"
            >
              Open a testnet faucet
            </a>
            .
          </span>
        </div>
      )}

      <fieldset
        disabled={isBusy || gasCheckLoading || gasCheckFailed}
        className="card flex flex-col gap-3 disabled:opacity-60"
      >
        <legend className="label-caps px-1">Approval scope</legend>
        <label className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-300 transition-colors has-[:checked]:border-accent-400/40 has-[:checked]:bg-accent-500/[0.06]">
          <input
            type="radio"
            name="approval-scope"
            checked={approvalMode === "exact"}
            onChange={() => setApprovalMode("exact")}
            className="mt-1 h-4 w-4 accent-[#00F0FF]"
          />
          <span>
            <strong className="text-slate-100">Approve this amount only</strong> (recommended) — the app
            can spend up to {draftAmount} USDC in total under this approval, even
            across multiple transfers.
          </span>
        </label>
        <label className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-300 transition-colors has-[:checked]:border-amber-400/40 has-[:checked]:bg-amber-500/[0.06]">
          <input
            type="radio"
            name="approval-scope"
            checked={approvalMode === "unlimited"}
            onChange={() => setApprovalMode("unlimited")}
            className="mt-1 h-4 w-4 accent-amber-500"
          />
          <span>
            <strong className="text-slate-100">Approve for future deposits too</strong> —{" "}
            <span className="text-amber-300">
              higher risk: this lets the app spend more in the future without
              asking again.
            </span>
          </span>
        </label>
      </fieldset>

      {errorMessage && (
        <div role="alert" className="banner-red flex items-start gap-2.5">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
          <span>
            <strong>{errorMessage.title}.</strong> {errorMessage.detail}
            {errorMessage === FAILURE_COPY.NO_GAS && (
              <>
                {" "}
                <a
                  href="https://www.alchemy.com/faucets/arbitrum-sepolia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rose-200 underline hover:text-rose-100"
                >
                  Open a testnet faucet
                </a>
                .
              </>
            )}
            {orphanedDepositId && (
              <>
                {" "}
                A deposit record was already created before this failed —{" "}
                <a
                  href={`/deposit/status/${orphanedDepositId}`}
                  className="text-rose-200 underline hover:text-rose-100"
                >
                  check its status
                </a>
                .
              </>
            )}
          </span>
        </div>
      )}

      <button
        onClick={handleApproveAndDeposit}
        disabled={isBusy || wrongNetwork || lowGas || gasCheckLoading || gasCheckFailed}
        className="btn-primary w-fit"
      >
        {(isBusy || gasCheckLoading) && <SpinnerIcon className="h-4 w-4" />}
        {step === "form" || step === "error"
          ? gasCheckLoading
            ? "Checking gas balance…"
            : gasCheckFailed
              ? "Can't verify gas balance"
              : lowGas
                ? "Add ETH to continue"
                : "Approve & deposit"
          : PROGRESS_COPY[step] ?? "Done"}
      </button>
      <FlowFooter />
    </main>
  );
}
