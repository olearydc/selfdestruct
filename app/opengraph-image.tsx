import { ImageResponse } from "next/og";

export const alt = "Selfdestruct — a secret that disappears when read";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          background: "#f7f5f2",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: "#b3541f",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <svg width="90" height="90" viewBox="0 0 32 32">
            <path
              d="M16 5 L18.6 13.4 L27 16 L18.6 18.6 L16 27 L13.4 18.6 L5 16 L13.4 13.4 Z"
              fill="#fff"
            />
          </svg>
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, color: "#1a1614" }}>Selfdestruct</div>
        <div style={{ fontSize: 32, color: "#706a63", marginTop: 20 }}>
          Send a secret. It disappears the moment it&apos;s read.
        </div>
      </div>
    ),
    { ...size },
  );
}
