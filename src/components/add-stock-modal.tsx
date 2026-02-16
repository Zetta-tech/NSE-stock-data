"use client";

import { useState, useRef, useEffect } from "react";

export function AddStockModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (symbol: string, name: string) => void;
}) {
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSymbol("");
      setName("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedSymbol = symbol.trim().toUpperCase();
    const trimmedName = name.trim();

    if (!trimmedSymbol) {
      setError("Symbol is required");
      return;
    }
    if (!trimmedName) {
      setError("Company name is required");
      return;
    }
    if (!/^[A-Z&]+$/.test(trimmedSymbol)) {
      setError("Invalid NSE symbol format");
      return;
    }

    onAdd(trimmedSymbol, trimmedName);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Add Stock to Watchlist</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-primary"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              NSE Symbol
            </label>
            <input
              ref={inputRef}
              type="text"
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                setError("");
              }}
              placeholder="e.g. TCS, WIPRO, ICICIBANK"
              className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Company Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="e.g. Tata Consultancy Services"
              className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
            />
          </div>

          {error && (
            <p className="text-xs text-danger">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-accent-hover active:scale-[0.98]"
            >
              Add Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
