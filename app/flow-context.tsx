"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Ephemeral, client-only state carried between the routed steps of the
// deposit flow (mock login identity, draft amount, KOL attribution).
// Backed by sessionStorage so a refresh mid-flow doesn't lose progress.
// This is NOT the deposit record itself — that only exists server-side
// once the user actually signs (see lib/store.ts).

interface FlowState {
  kolRef: string | null;
  mockIdentity: string | null; // e.g. "demo@exchangeo.test" or a wallet address
  draftAmount: string;
  approvalMode: "exact" | "unlimited";
}

const DEFAULT_STATE: FlowState = {
  kolRef: null,
  mockIdentity: null,
  draftAmount: "",
  approvalMode: "exact",
};

const STORAGE_KEY = "exo_flow_state";

interface FlowContextValue extends FlowState {
  setKolRef: (ref: string | null) => void;
  setMockIdentity: (identity: string | null) => void;
  setDraftAmount: (amount: string) => void;
  setApprovalMode: (mode: "exact" | "unlimited") => void;
}

const FlowContext = createContext<FlowContextValue | null>(null);

export function FlowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FlowState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
    } catch {
      // ignore — sessionStorage unavailable, fall back to defaults
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, hydrated]);

  const value: FlowContextValue = {
    ...state,
    setKolRef: (kolRef) => setState((s) => ({ ...s, kolRef })),
    setMockIdentity: (mockIdentity) => setState((s) => ({ ...s, mockIdentity })),
    setDraftAmount: (draftAmount) => setState((s) => ({ ...s, draftAmount })),
    setApprovalMode: (approvalMode) => setState((s) => ({ ...s, approvalMode })),
  };

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow must be used within FlowProvider");
  return ctx;
}
