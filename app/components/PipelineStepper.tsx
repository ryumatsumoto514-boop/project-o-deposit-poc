// Replaces the old 3 static feature-text blocks on the landing page: a
// live-looking 4-stage pipeline stepper matching the real states the actual
// status tracker (app/deposit/status/[id]/page.tsx) reports. The tx-hash
// values here are a fixed example FORMAT for the marketing page only,
// explicitly captioned "(example format)" — the real tracker shows real
// hashes. LED dots stagger their pulse via animation-delay so the row reads
// as continuous activity rather than four static labels.
const STAGES = [
  {
    label: "Signed",
    telemetry: "Wallet signature captured, broadcasting the deposit.",
    hash: "0x7fA3…c81D",
  },
  {
    label: "Arbitrum Confirmed",
    telemetry: "On-chain receipt independently verified by the engine.",
    hash: "0x2b9E…4f10",
  },
  {
    label: "Bridging (simulated)",
    telemetry: "After the testnet transfer, a simulated delay represents bridging. No funds move to Hyperliquid.",
    hash: null,
  },
  {
    label: "Hyperliquid credit (simulated)",
    telemetry: "A mock balance check completes the demo. No actual trading balance is credited.",
    hash: null,
  },
] as const;

export function PipelineStepper() {
  return (
    <div className="card-flush flex flex-col divide-y divide-white/[0.1] p-0 sm:flex-row sm:divide-x sm:divide-y-0">
      {STAGES.map((stage, i) => (
        <div key={stage.label} className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <span
              className="led-dot led-live bg-accent-400 text-accent-400"
              style={{ animationDelay: `${i * 0.45}s` }}
            />
            <span className="label-caps text-slate-500">Stage {i + 1}</span>
          </div>
          <p className="text-sm font-semibold text-slate-100">{stage.label}</p>
          <p className="text-[12px] leading-relaxed text-slate-500">{stage.telemetry}</p>
          {stage.hash && (
            <p className="mt-auto pt-1 font-mono text-[11px] text-slate-600">
              {stage.hash} <span className="text-slate-700">(example format)</span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
