import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Shared with app/icon.tsx: the LogoMark's segmented-ring motif, so a link
// a KOL shares (the app's actual distribution channel per SPEC.md) previews
// with the same brand mark instead of a blank/generic card.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0C10",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32">
          <circle
            cx="16"
            cy="16"
            r="9.5"
            fill="none"
            stroke="#00F0FF"
            strokeWidth="2.2"
            strokeDasharray="10 4.2"
            strokeLinecap="round"
            transform="rotate(-90 16 16)"
          />
          <circle cx="16" cy="16" r="2.6" fill="#00F0FF" />
        </svg>
        <div
          style={{
            marginTop: 36,
            fontSize: 64,
            fontWeight: 700,
            color: "#F4F6F8",
            letterSpacing: -1,
          }}
        >
          Exchange O
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 28,
            color: "#8B93A1",
          }}
        >
          Deposit tracking, in plain language — testnet demo
        </div>
      </div>
    ),
    { ...size }
  );
}
