import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const font = () => readFile(join(process.cwd(), "node_modules/@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff"));

/** App icon: the logo's gold serif N with its ribbon, on logo navy (home screen, notifications, tab). */
export async function appIcon(size: number) {
  const s = size / 64;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0B2A55", position: "relative" }}>
        <div style={{ display: "flex", color: "#E2BF7A", fontFamily: "Playfair", fontSize: 40 * s, lineHeight: 1, marginTop: -6 * s }}>N</div>
        <svg width={size} height={size} viewBox="0 0 64 64" style={{ position: "absolute", left: 0, top: 0 }}>
          <path d="M12 47 C 26 53, 42 52, 54 43 C 42 49, 26 50, 12 47 Z" fill="#C29545" />
        </svg>
      </div>
    ),
    { width: size, height: size, fonts: [{ name: "Playfair", data: await font(), weight: 600, style: "normal" }] },
  );
}
