"use client";

import { useFlow } from "../flow-context";

// UX improvement #5: persistent compliance/trust disclosure, not a
// marketing widget. Reads from flow state so it survives navigation even
// once the ?ref= param is gone from the URL.
export function KolBanner() {
  const { kolRef } = useFlow();
  if (!kolRef) return null;

  return (
    <div className="w-full rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      You arrived via <strong>{kolRef}</strong>&apos;s content. Exchange O is
      independent — deposit and trading decisions are yours alone.
    </div>
  );
}

export function MockedBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-md border border-purple-300 bg-purple-50 px-4 py-3 text-sm text-purple-900">
      <strong>Mocked for this PoC:</strong> {children}
    </div>
  );
}
