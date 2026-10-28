import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "NEELARYAN Café — Crave the Goodness", template: "%s · NEELARYAN Café" },
  description:
    "Order from NEELARYAN Café — dine in with a table QR or order online. Build your own oats bowl and milkshake in 3D, track your order live and collect stamps.",
  applicationName: "NEELARYAN Café",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbf6ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh bg-ivory font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
