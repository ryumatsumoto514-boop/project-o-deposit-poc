import { Fragment } from "react";

// The hero's "O Engine" visual anchor: a 3-node telemetry pipeline
// (deposit -> reconciliation engine -> credited balance) with dots
// animating along the connector rails, pure CSS/SVG (`.flow-dot` /
// `.node-pulse`, defined in globals.css) — no canvas library. This mirrors
// the *shape* of the real reconciliation flow but is a perpetual marketing
// loop, not wired to any live deposit; the "illustrative" label below says
// so explicitly rather than implying it's a real telemetry feed.
const NODES = [
  { key: "deposit", label: "USDC Deposit", sub: "Arbitrum Sepolia" },
  { key: "engine", label: "Reconciliation Engine", sub: "Verifying + relaying" },
  { key: "credit", label: "Hyperliquid Credit", sub: "Tradable balance" },
] as const;

function NodeIcon({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 7.5v9M9.3 10c0-1.1 1.1-2 2.7-2s2.7.8 2.7 1.9c0 2.6-5.4 1.5-5.4 4 0 1.1 1.1 1.9 2.7 1.9s2.7-.8 2.7-1.9"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" strokeDasharray="7 3" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EngineVisual() {
  return (
    <div className="card flex flex-col gap-6 p-6 sm:p-8">
      <span className="label-caps">O Engine · live telemetry (illustrative)</span>

      <div className="flex items-center">
        {NODES.map((node, i) => (
          <Fragment key={node.key}>
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-accent-400/40 bg-accent-400/[0.08] text-accent-300 ${
                i === 1 ? "node-pulse" : ""
              }`}
            >
              <NodeIcon index={i} />
            </div>
            {i < NODES.length - 1 && (
              <div className="relative mx-1 h-px flex-1 bg-white/[0.15]">
                <span
                  className="flow-dot absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent-400"
                  style={{
                    boxShadow: "0 0 6px 2px rgba(0, 240, 255, 0.6)",
                    animationDelay: i === 1 ? "1.1s" : "0s",
                  }}
                />
              </div>
            )}
          </Fragment>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {NODES.map((node) => (
          <div key={node.key} className="flex flex-col gap-0.5">
            <p className="text-[11px] font-medium leading-tight text-slate-200">{node.label}</p>
            <p className="font-mono text-[10px] leading-tight text-slate-500">{node.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.15] pt-4 font-mono text-[11px] text-slate-500">
        <span>
          THROUGHPUT <span className="text-accent-300">~1 dep / 8s</span>
        </span>
        <span>
          SETTLEMENT <span className="text-accent-300">2-of-2 verified</span>
        </span>
      </div>
    </div>
  );
}
