"use client";

import { useEffect } from "react";

// Every screen is a client component, so Next's server-only `metadata`
// export can't vary the tab title per route — every route was shipping the
// same root-layout title. That matters most for the status-tracker page,
// which the app's own copy tells users to leave open in a background tab
// while it polls; without this, that tab is indistinguishable from any
// other Exchange O tab.
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — Exchange O`;
  }, [title]);
}
