"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useFlow } from "../flow-context";

// A KOL's link should attribute the visit no matter which route it points
// to — SPEC.md's own example is the landing page (`/?ref=...`), but a KOL
// or a shortener could just as easily deep-link into `/login?ref=...` or
// any other flow step. Mounted once at the root so every route captures
// `?ref=` on first load, instead of only the page that happened to have
// this logic copied into it.
export function CaptureKolRef() {
  const searchParams = useSearchParams();
  const { setKolRef } = useFlow();
  const ref = searchParams.get("ref");

  useEffect(() => {
    if (ref) setKolRef(ref);
  }, [ref, setKolRef]);

  return null;
}
