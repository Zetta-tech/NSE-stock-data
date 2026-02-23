import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
      <body className="min-h-screen noise-overlay">
        <div className="bg-scene" aria-hidden="true">
          <div className="bg-blur-orb bg-blur-orb--accent" />
          <div className="bg-blur-orb bg-blur-orb--blue" />
          <div className="bg-blur-orb bg-blur-orb--dim" />
        </div>
        <div className="relative z-10">{children}</div>
        <SpeedInsights />
      </body>
    </html>
  );
}
