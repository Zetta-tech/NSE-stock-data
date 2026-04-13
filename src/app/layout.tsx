import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tickzy.dev"),
  title: "Tickzy — NSE Breakout Scanner",
  description:
    "Real-time breakout detection for NSE stocks. Monitor Nifty 50 and custom watchlists for price and volume breakouts.",
  openGraph: {
    title: "Tickzy — NSE Breakout Scanner",
    description:
      "Real-time breakout detection for NSE stocks. Monitor Nifty 50 and custom watchlists for price and volume breakouts.",
    url: "https://tickzy.dev",
    siteName: "Tickzy",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen noise-overlay font-sans antialiased">
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
