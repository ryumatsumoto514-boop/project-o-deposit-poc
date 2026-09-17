"use client";

import { useFlow } from "../flow-context";
import { ShieldIcon } from "./icons";

// UX improvement #5: persistent compliance/trust disclosure, not a
// marketing widget. Reads from flow state so it survives navigation even
// once the ?ref= param is gone from the URL.
export function KolBanner() {
  const { kolRef } = useFlow();
  if (!kolRef) return null;

  return (
    <div className="banner-amber flex w-full items-start gap-2.5">
      <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <span>
        You arrived via <strong>{kolRef}</strong>&apos;s content. Exchange O
        is independent — deposit and trading decisions are yours alone.
      </span>
    </div>
  );
}

export function MockedBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="banner-purple w-full">
      <strong>Mocked for this PoC:</strong> {children}
    </div>
  );
}
