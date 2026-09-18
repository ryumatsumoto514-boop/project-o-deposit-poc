import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0c10",
        }}
      >
        <div
          style={{
            width: 132,
            height: 132,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0d1015",
            borderRadius: 30,
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <svg width="96" height="96" viewBox="0 0 32 32">
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
      </div>
    ),
    { ...size }
  );
}
