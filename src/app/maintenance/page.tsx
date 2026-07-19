import type { Metadata } from "next";
import { MAINTENANCE_MESSAGE } from "@/maintenance";

export const metadata: Metadata = {
  title: "Maintenance | Tickzy",
  description: MAINTENANCE_MESSAGE,
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="card-elevated relative w-full max-w-lg overflow-hidden rounded-3xl bg-[var(--surface-raised)] px-8 py-12 text-center ring-1 ring-[var(--surface-border)] sm:px-12">
        <div
          aria-hidden="true"
          className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
        />

        <div className="mb-7 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v4" />
              <path d="m16.24 7.76 2.83-2.83" />
              <path d="M18 12h4" />
              <path d="m16.24 16.24 2.83 2.83" />
              <path d="M12 18v4" />
              <path d="m7.76 16.24-2.83 2.83" />
              <path d="M6 12H2" />
              <path d="m7.76 7.76-2.83-2.83" />
            </svg>
          </div>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Tickzy
        </p>
        <h1 className="font-display text-3xl font-bold text-text-primary">
          Maintenance in progress
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-text-secondary">
          {MAINTENANCE_MESSAGE}
        </p>
        <p className="mt-6 text-xs text-text-muted">
          Thank you for your patience.
        </p>
      </section>
    </main>
  );
}
