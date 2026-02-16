"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { NIFTY_50_STOCKS } from "@/lib/nifty50";
import type { WatchlistStock } from "@/lib/types";

const MIN_SEARCH_LENGTH = 3;

export function AddStockModal({
  open,
  onClose,
  onAdd,
  currentSymbols,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (symbol: string, name: string) => void;
  currentSymbols: string[];
}) {
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const matches = useMemo(() => {
    if (query.length < MIN_SEARCH_LENGTH) return [];
    const q = query.toLowerCase();
    return NIFTY_50_STOCKS.filter(
      (s) =>
        (s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)) &&
        !currentSymbols.includes(s.symbol)
    );
  }, [query, currentSymbols]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [matches.length]);

  useEffect(() => {
    if (listRef.current && highlightIndex >= 0) {
      const el = listRef.current.children[highlightIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  function handleSelect(stock: WatchlistStock) {
    onAdd(stock.symbol, stock.name);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && matches[highlightIndex]) {
      e.preventDefault();
      handleSelect(matches[highlightIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  const showHint = query.length > 0 && query.length < MIN_SEARCH_LENGTH;
  const showNoResults =
    query.length >= MIN_SEARCH_LENGTH && matches.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg animate-scale-in">
        <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-2xl shadow-black/40">
          <div className="relative border-b border-surface-border">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search Nifty 50 stocks..."
              className="w-full bg-transparent py-4 pl-12 pr-16 text-base text-text-primary placeholder:text-text-muted outline-none"
            />
            <button
              onClick={onClose}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-surface-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-secondary"
            >
              ESC
            </button>
          </div>

          <div
            ref={listRef}
            className="max-h-72 overflow-y-auto scrollbar-thin"
          >
            {query.length === 0 && (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-overlay">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-text-muted"
                  >
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                </div>
                <p className="text-sm text-text-secondary">
                  Add a Nifty 50 stock to your watchlist
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Start typing a company name or symbol (min 3 letters)
                </p>
              </div>
            )}

            {showHint && (
              <div className="px-4 py-6 text-center text-xs text-text-muted">
                Type at least {MIN_SEARCH_LENGTH - query.length} more
                character{MIN_SEARCH_LENGTH - query.length > 1 ? "s" : ""} to
                search...
              </div>
            )}

            {showNoResults && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-text-secondary">No matches found</p>
                <p className="mt-1 text-xs text-text-muted">
                  Try a different search term. Only Nifty 50 stocks are
                  available.
                </p>
              </div>
            )}

            {matches.map((stock, i) => (
              <button
                key={stock.symbol}
                onClick={() => handleSelect(stock)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                  i === highlightIndex
                    ? "bg-accent/[0.08]"
                    : "hover:bg-surface-overlay/60"
                }`}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-overlay text-xs font-bold text-text-secondary">
                  {stock.symbol.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">
                      {highlightMatch(stock.symbol, query)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-text-muted">
                    {highlightMatch(stock.name, query)}
                  </p>
                </div>
                {i === highlightIndex && (
                  <span className="flex-shrink-0 rounded-md bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                    Add
                  </span>
                )}
              </button>
            ))}
          </div>

          {matches.length > 0 && (
            <div className="flex items-center gap-4 border-t border-surface-border px-4 py-2.5 text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-surface-border bg-surface-overlay px-1 py-0.5 font-mono text-[10px]">
                  &uarr;&darr;
                </kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-surface-border bg-surface-overlay px-1 py-0.5 font-mono text-[10px]">
                  &crarr;
                </kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-surface-border bg-surface-overlay px-1 py-0.5 font-mono text-[10px]">
                  esc
                </kbd>
                close
              </span>
              <span className="ml-auto tabular-nums">
                {matches.length} result{matches.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (query.length < MIN_SEARCH_LENGTH) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-accent font-semibold">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}
