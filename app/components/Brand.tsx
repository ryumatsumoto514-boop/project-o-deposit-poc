// Custom geometric mark — a segmented ring (three arcs, radar/telemetry-
// sweep style) around a solid core dot, rendered in the single brand
// accent (Hyper Turquoise). Deliberately not a generic rounded-square
// letter badge: the segmentation reads as "signal/reconciliation," in
// keeping with the app's actual subject (an engine reconciling signals
// across two chains).
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="7" fill="#0d1015" stroke="rgba(255,255,255,0.15)" />
      <circle
        cx="16"
        cy="16"
        r="9.5"
        fill="none"
        stroke="#00F0FF"
        strokeWidth="2.25"
        strokeDasharray="10 4.2"
        strokeLinecap="round"
        transform="rotate(-90 16 16)"
      />
      <circle cx="16" cy="16" r="2.25" fill="#00F0FF" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <LogoMark className="h-8 w-8 shrink-0" />
      <span
        className={`brand-word truncate text-[13px] text-slate-100 ${
          compact ? "hidden" : ""
        }`}
      >
        Exchange O
      </span>
    </div>
  );
}
