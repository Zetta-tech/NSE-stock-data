import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nifty Breakout Scanner",
  description:
    "Scan Nifty 50 stocks for 5-day high and volume breakouts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen noise-overlay">{children}</body>
    </html>
  );
}
