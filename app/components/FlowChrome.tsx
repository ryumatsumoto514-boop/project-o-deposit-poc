import { ShieldIcon } from "./icons";

const STEPS = ["Sign in", "Amount", "Confirm", "Approve"] as const;

// Real screenshots at 375px showed short single-card screens (login, amount,
// confirm, approve/blocked) leaving 50-65% of the viewport as dead empty
// space below the card once `.page-shell` stopped forcing a centered
// layout — anchoring content to the top just moved the void to the bottom
// instead of removing it. `mt-auto` on this footer pins it to the bottom of
// the flex column *only when there's leftover space*, so short screens gain
// real content there instead of a void, while longer screens (confirm with
// its address block, approve with its scope cards) are unaffected since the
// footer simply follows normal flow once content already fills the height.
export function StepProgress({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label-caps shrink-0">
        Step {step} of {STEPS.length}
      </span>
      <div className="flex flex-1 gap-1.5">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < step ? "bg-blue-500" : "bg-white/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function FlowFooter() {
  return (
    <footer className="mt-auto flex flex-col items-center gap-2 pt-10 text-center">
      <div className="flex items-center gap-1.5 text-[12px] text-slate-600">
        <ShieldIcon className="h-3.5 w-3.5 shrink-0" />
        <span>Arbitrum Sepolia testnet &middot; no real funds are used</span>
      </div>
      <p className="text-[11px] text-slate-700">
        Every step above is verified against real on-chain state, not a mock timer.
      </p>
    </footer>
  );
}
