"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertIcon } from "./components/icons";

export default function ErrorBoundary({
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
    <main className="page-shell items-center justify-center text-center">
      <div className="card flex flex-col items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-rose-400/25 bg-rose-400/[0.08] text-rose-300">
          <AlertIcon className="h-5 w-5" />
        </span>
        <p className="eyebrow">Something went wrong</p>
        <h1 className="h1">This screen hit an error</h1>
        <p className="body-text">
          No deposit or balance was affected — this is a display error in the
          demo UI. Try again, or head back and resume from the deposit flow.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => reset()} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="btn-secondary">
            Back to Exchange O
          </Link>
        </div>
      </div>
    </main>
  );
}
