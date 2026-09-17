// UX improvement #4: every screen must label which wallet/account is which
// — never a bare "your wallet". Login identity, funding wallet, and the
// (mocked) trading account can all differ.
//
// Addresses are truncated here (this is a quick-reference summary, shown on
// every step) — the dedicated full-address confirmation lives on
// /deposit/confirm, where showing the untruncated address actually matters
// for security review.

import { truncateAddress } from "@/lib/format";

function Row({ label, value }: { label: string; value: string | null }) {
  const display = value && value.startsWith("0x") ? truncateAddress(value) : value;
  return (
    <div className="flex flex-col gap-0.5 border-b border-white/[0.06] py-2.5 last:border-b-0">
      <span className="label-caps">{label}</span>
      <span className="truncate font-mono text-[13px] text-slate-200" title={value ?? undefined}>
        {display ?? "—"}
      </span>
    </div>
  );
}

export function WalletRoles({
  signingInAs,
  fundsFrom,
  tradableIn,
}: {
  signingInAs?: string | null;
  fundsFrom?: string | null;
  tradableIn?: string | null;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5">
      {signingInAs !== undefined && <Row label="Signing in as" value={signingInAs} />}
      {fundsFrom !== undefined && <Row label="Funds coming from" value={fundsFrom} />}
      {tradableIn !== undefined && <Row label="Will be tradable in" value={tradableIn} />}
    </div>
  );
}
