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
import { StepProgress, FlowFooter } from "../../components/FlowChrome";
import { deriveMockTradingAccount } from "@/lib/hyperliquidMock";
import { CHAIN, DEPOSIT_ADDRESS, ERC20_ABI, USDC_ADDRESS, USDC_DECIMALS } from "@/lib/chain";
import { wagmiConfig } from "@/lib/wagmiConfig";
import { FAILURE_COPY } from "@/lib/failures";
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

export default function DepositApprovePage() {
  const router = useRouter();
  const { mockIdentity, draftAmount, addressConfirmed, kolRef, approvalMode, setApprovalMode, hydrated } =
    useFlow();
  const { address, chainId } = useAccount();
  const { data: ethBalance } = useBalance({ address, chainId: CHAIN.id });
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const [step, setStep] = useState<Step>("form");
  const [errorMessage, setErrorMessage] = useState<{ title: string; detail: string } | null>(null);
  const [blockedDeposit, setBlockedDeposit] = useState<DepositRecord | null>(null);
  const [orphanedDepositId, setOrphanedDepositId] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!mockIdentity || !draftAmount || !address) {
      router.replace("/deposit");
    } else if (!addressConfirmed) {
      router.replace("/deposit/confirm");
    }
  }, [hydrated, mockIdentity, draftAmount, address, addressConfirmed, router]);

  if (!hydrated || !mockIdentity || !draftAmount || !address || !addressConfirmed) return null;

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
        hash: approveTxHash,
      });
      if (receipt.status !== "success") {
        await fetch(`/api/deposits/${deposit.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: "STALLED_NO_GAS",
            failureReason: FAILURE_COPY.NO_GAS.title,
          }),
        });
        setErrorMessage(FAILURE_COPY.NO_GAS);
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
        setErrorMessage(FAILURE_COPY.UNKNOWN);
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
        </div>
      )}

      {lowGas && (
        <div className="banner-amber flex items-start gap-2.5">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <span>
            <strong>{FAILURE_COPY.NO_GAS.title}.</strong> Current balance:{" "}
            {ethBalance ? formatEther(ethBalance.value) : "0"} ETH.{" "}
            {FAILURE_COPY.NO_GAS.detail}
          </span>
        </div>
      )}

      <fieldset className="card flex flex-col gap-3">
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
        disabled={isBusy || wrongNetwork}
        className="btn-primary w-fit"
      >
        {isBusy && <SpinnerIcon className="h-4 w-4" />}
        {step === "form" || step === "error"
          ? "Approve & deposit"
          : step === "checking"
          ? "Checking for existing deposits…"
          : step === "awaiting-signature"
          ? "Waiting for your signature…"
          : step === "confirming-approval"
          ? "Confirming approval on-chain…"
          : step === "pulling"
          ? "Starting deposit transfer…"
          : "Done"}
      </button>
      <FlowFooter />
    </main>
  );
}
