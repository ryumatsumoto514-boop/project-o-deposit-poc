"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useBalance } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { parseUnits, maxUint256, formatEther, parseEther } from "viem";
import { useFlow } from "../../flow-context";
import { KolBanner } from "../../components/KolBanner";
import { WalletRoles } from "../../components/WalletRoles";
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
  const { mockIdentity, draftAmount, kolRef, approvalMode, setApprovalMode } = useFlow();
  const { address } = useAccount();
  const { data: ethBalance } = useBalance({ address, chainId: CHAIN.id });

  const [step, setStep] = useState<Step>("form");
  const [errorMessage, setErrorMessage] = useState<{ title: string; detail: string } | null>(null);
  const [blockedDeposit, setBlockedDeposit] = useState<DepositRecord | null>(null);

  useEffect(() => {
    if (!mockIdentity || !draftAmount || !address) router.replace("/deposit");
  }, [mockIdentity, draftAmount, address, router]);

  if (!mockIdentity || !draftAmount || !address) return null;

  const lowGas = ethBalance !== undefined && ethBalance.value < MIN_GAS_WEI;

  async function handleApproveAndDeposit() {
    if (!address) return;
    setErrorMessage(null);
    setStep("checking");

    try {
      const checkRes = await fetch(
        `/api/deposits/check?wallet=${address}&amount=${draftAmount}`
      );
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
      setStep("error");
    }
  }

  if (step === "blocked" && blockedDeposit) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
        <KolBanner />
        <h1 className="text-lg font-semibold">Deposit already in progress</h1>
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You already have a deposit in progress for this amount, opened at{" "}
          {new Date(blockedDeposit.createdAt).toLocaleString()}. Do not send
          again — here&apos;s its current status.
        </div>
        <button
          onClick={() => router.push(`/deposit/status/${blockedDeposit.id}`)}
          className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          View deposit status
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <KolBanner />
      <h1 className="text-lg font-semibold">Approve + deposit</h1>

      <WalletRoles
        signingInAs={mockIdentity}
        fundsFrom={address}
        tradableIn={deriveMockTradingAccount(address)}
      />

      <div className="rounded-md border border-neutral-200 p-3 text-sm">
        Depositing <strong>{draftAmount} USDC</strong> on Arbitrum Sepolia.
      </div>

      {lowGas && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <strong>{FAILURE_COPY.NO_GAS.title}.</strong> Current balance:{" "}
          {ethBalance ? formatEther(ethBalance.value) : "0"} ETH.{" "}
          {FAILURE_COPY.NO_GAS.detail}
        </div>
      )}

      <fieldset className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
        <legend className="px-1 text-sm font-medium">Approval scope</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            checked={approvalMode === "exact"}
            onChange={() => setApprovalMode("exact")}
            className="mt-1"
          />
          <span>
            <strong>Approve this amount only</strong> (recommended) — the app
            can only ever move exactly {draftAmount} USDC, once.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            checked={approvalMode === "unlimited"}
            onChange={() => setApprovalMode("unlimited")}
            className="mt-1"
          />
          <span>
            <strong>Approve for future deposits too</strong> —{" "}
            <span className="text-red-700">
              higher risk: this lets the app spend more in the future without
              asking again.
            </span>
          </span>
        </label>
      </fieldset>

      {errorMessage && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <strong>{errorMessage.title}.</strong> {errorMessage.detail}
        </div>
      )}

      <button
        onClick={handleApproveAndDeposit}
        disabled={step !== "form" && step !== "error"}
        className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
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
    </main>
  );
}
