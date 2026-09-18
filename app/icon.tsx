import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Matches the in-app LogoMark (app/components/Brand.tsx): a segmented ring
// around a solid core, in the brand accent (Hyper Turquoise), on the
// obsidian background — not the stock Next.js icon, and not the old flat
// blue "O" letter badge.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1015",
          borderRadius: 7,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 32 32">
          <circle
            cx="16"
            cy="16"
            r="9.5"
            fill="none"
            stroke="#00F0FF"
            strokeWidth="2.6"
            strokeDasharray="10 4.2"
            strokeLinecap="round"
            transform="rotate(-90 16 16)"
          />
          <circle cx="16" cy="16" r="2.6" fill="#00F0FF" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
