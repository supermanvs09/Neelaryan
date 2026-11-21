import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { themeScript } from "@/components/theme";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "NEELARYAN Café — Crave the Goodness", template: "%s · NEELARYAN" },
  description: "Order at NEELARYAN Café: scan your table QR or order takeaway, build your own oats bowl or milkshake, track your order live and earn rewards.",
  applicationName: "NEELARYAN Café",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4EEE2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-fg antialiased">{children}</body>
    </html>
  );
}
