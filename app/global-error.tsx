"use client";

import { useEffect } from "react";

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
      <body
        style={{
          background: "#0A0C10",
          color: "#E6EDF3",
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#FDA4AF" }}>
            Something went wrong
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: "8px 0" }}>
            Exchange O hit an error
          </h1>
          <p style={{ color: "#94A3B8", marginBottom: 20 }}>
            We couldn’t load this screen, so we can’t confirm your deposit status.
            If you already signed a transaction, check its status in your wallet
            before sending again. Retrying this screen does not cancel a submitted
            transaction.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#00F0FF",
              color: "#05070A",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
