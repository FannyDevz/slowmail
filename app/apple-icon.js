import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Versi PNG dari app/icon.svg untuk layar utama iOS. Tanpa bingkai luar, iOS membulatkan sudutnya sendiri.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#5294ff"/>
  <rect x="12" y="18" width="40" height="28" rx="3" fill="#fff" stroke="#000" stroke-width="4"/>
  <path d="M14 21 L32 35 L50 21" fill="none" stroke="#000" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="48" cy="47" r="8" fill="#facc00" stroke="#000" stroke-width="3.5"/>
  <path d="M48 42.5 V47 L51 49" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export default function AppleIcon() {
  const src = `data:image/svg+xml;base64,${Buffer.from(SVG).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={src} width={180} height={180} />
      </div>
    ),
    size,
  );
}
