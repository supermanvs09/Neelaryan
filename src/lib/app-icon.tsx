import { ImageResponse } from "next/og";

/** Plain "N" tile used for the home-screen icon and notifications (matches the wordmark). */
export function appIcon(size: number) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#45607B", color: "#FFFFFF", fontSize: size * 0.56, fontWeight: 700, fontFamily: "sans-serif" }}>N</div>
    ),
    { width: size, height: size },
  );
}
