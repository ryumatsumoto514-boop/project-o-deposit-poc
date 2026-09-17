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
          background: "#0a0b0d",
        }}
      >
        <div
          style={{
            width: 132,
            height: 132,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#3b82f6",
            borderRadius: 30,
            color: "white",
            fontSize: 74,
            fontWeight: 700,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          O
        </div>
      </div>
    ),
    { ...size }
  );
}
