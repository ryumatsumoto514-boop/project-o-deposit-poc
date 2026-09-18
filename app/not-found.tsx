import Link from "next/link";
import { AlertIcon } from "./components/icons";

export default function NotFound() {
  return (
    <main className="page-shell items-center justify-center text-center">
      <div className="card flex flex-col items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/[0.08] text-amber-300">
          <AlertIcon className="h-5 w-5" />
        </span>
        <p className="eyebrow">404</p>
        <h1 className="h1">Page not found</h1>
        <p className="body-text">
          This link doesn&apos;t match anything in the deposit demo — it may
          be mistyped or the flow step has moved.
        </p>
        <Link href="/" className="btn-primary mt-2">
          Back to Exchange O
        </Link>
      </div>
    </main>
  );
}
