"use client";

import { useEffect } from "react";
import "./globals.css";
import { AlertIcon } from "./components/icons";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      {/* The root layout itself crashed, so this can't assume AppHeader,
          providers, or router context survived — plain <a>, not next/link,
          and a self-contained shell instead of page-shell/AppHeader-relative
          classes, but still the same design tokens as app/error.tsx. */}
      <body className="min-h-[100dvh] bg-[#05070A] font-sans text-slate-100 antialiased">
        <main className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10 text-center">
          <div role="alert" className="card flex w-full max-w-[420px] flex-col items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-rose-400/25 bg-rose-400/[0.08] text-rose-300">
              <AlertIcon className="h-5 w-5" />
            </span>
            <p className="eyebrow">Something went wrong</p>
            <h1 className="h1">Exchange O hit an error</h1>
            <p className="body-text">
              We couldn’t load this screen, so we can’t confirm your deposit status.
              If you already signed a transaction, check its status in your wallet
              before sending again. Retrying this screen does not cancel a submitted
              transaction.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => reset()} className="btn-primary">
                Try again
              </button>
              <a href="/" className="btn-secondary">
                Back to Exchange O
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
