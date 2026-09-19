"use client";

import { useFlow } from "../flow-context";
import { ShieldIcon } from "./icons";

// SPEC.md's own disclosure copy names a person ("You arrived via [KOL Alex]'s
// content"), not a raw ?ref= slug — this maps known demo referral codes to a
// display name and falls back to a readable title-cased version of unknown
// ones, so the banner never surfaces "kol_alex" verbatim to a real user.
const KNOWN_KOLS: Record<string, string> = {
  kol_alex: "KOL Alex",
};

function formatKolName(ref: string): string {
  if (Object.prototype.hasOwnProperty.call(KNOWN_KOLS, ref)) return KNOWN_KOLS[ref];
  return ref
    .replace(/^kol[_-]?/i, "")
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ") || ref;
}

// UX improvement #5: persistent compliance/trust disclosure, not a
// marketing widget. Reads from flow state so it survives navigation even
// once the ?ref= param is gone from the URL.
export function KolBanner() {
  const { kolRef } = useFlow();
  if (!kolRef) return null;

  return (
    <div className="banner-amber flex w-full items-start gap-2.5">
      <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <span className="min-w-0 [overflow-wrap:anywhere] text-amber-100/90">
        You arrived via <strong className="text-amber-100">{formatKolName(kolRef)}</strong>&apos;s
        content. Exchange O is independent — deposit and trading decisions
        are yours alone.
      </span>
    </div>
  );
}

export function MockedBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="banner-accent w-full">
      <strong>Mocked for this PoC:</strong> {children}
    </div>
  );
}
