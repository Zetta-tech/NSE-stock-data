import { AnalyzeView } from "@/components/analyze-view";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const revalidate = 60; // Cache data for 60 seconds

export default async function AnalyzePage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;

  return (
    <div className="min-h-screen bg-surface-background text-surface-text relative isolate">
      {/* Mobile Sticky / Desktop Absolute Navigation */}
      <div className="sticky top-0 z-50 w-full p-4 bg-surface-background/80 backdrop-blur border-b border-surface-border md:border-none md:bg-transparent md:absolute md:top-6 md:left-6 md:w-auto md:p-0">
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-surface-text-secondary hover:text-surface-text transition-colors touch-manipulation min-h-[44px] px-2 -ml-2"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back to Dashboard</span>
        </Link>
      </div>

      {/* Main UI Area */}
      <main className="h-[100dvh] pt-[76px] md:pt-0 pt-safe">
        <AnalyzeView symbol={symbol} />
      </main>
    </div>
  );
}
