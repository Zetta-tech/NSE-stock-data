"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { NIFTY_50_STOCKS } from "@/lib/nifty50";

const MIN_SEARCH_LENGTH = 3;
const DEBOUNCE_MS = 350;

const SEARCH_MESSAGES = [
  "Venturing beyond Nifty 50\u2026",
  "Scanning the wider market\u2026",
  "Searching the long tail\u2026",
];

function randomMessage() {
  return SEARCH_MESSAGES[Math.floor(Math.random() * SEARCH_MESSAGES.length)];
}

interface SearchResult {
  symbol: string;
  name: string;
  source: "nifty50" | "nse";
}

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
  const [wideSearch, setWideSearch] = useState(false);
  const [nseResults, setNseResults] = useState<SearchResult[]>([]);
  const [nseLoading, setNseLoading] = useState(false);
  const [nseFetched, setNseFetched] = useState(false);
  const [searchMsg, setSearchMsg] = useState(SEARCH_MESSAGES[0]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightIndex(0);
      setWideSearch(false);
      setNseResults([]);
      setNseLoading(false);
      setNseFetched(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [open]);

  const niftyMatches = useMemo(() => {
    if (query.length < MIN_SEARCH_LENGTH) return [];
    const q = query.toLowerCase();
    return NIFTY_50_STOCKS.filter(
      (s) =>
        (s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)) &&
        !currentSymbols.includes(s.symbol)
    ).map(
      (s): SearchResult => ({
        symbol: s.symbol,
        name: s.name,
        source: "nifty50",
      })
    );
  }, [query, currentSymbols]);

  const fetchNseResults = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (q.length < MIN_SEARCH_LENGTH) {
        setNseResults([]);
        setNseLoading(false);
        setNseFetched(false);
        return;
      }

      setNseLoading(true);
      setNseFetched(false);
      setSearchMsg(randomMessage());

      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const res = await fetch(
            `/api/search?q=${encodeURIComponent(q)}`,
            { signal: controller.signal }
          );
          const data = await res.json();
          if (controller.signal.aborted) return;

          const results: SearchResult[] = (data.results || [])
            .filter(
              (r: { symbol: string }) =>
                !currentSymbols.includes(r.symbol)
            )
            .map(
              (r: { symbol: string; name: string }): SearchResult => ({
                symbol: r.symbol,
                name: r.name,
                source: "nse",
              })
            );

          setNseResults(results);
        } catch {
          if (!controller.signal.aborted) {
            setNseResults([]);
          }
        } finally {
          if (!controller.signal.aborted) {
            setNseLoading(false);
            setNseFetched(true);
          }
        }
      }, DEBOUNCE_MS);
    },
    [currentSymbols]
  );

  useEffect(() => {
    if (wideSearch) {
      fetchNseResults(query);
    } else {
      setNseResults([]);
      setNseLoading(false);
      setNseFetched(false);
    }
  }, [query, wideSearch, fetchNseResults]);

  const matches = useMemo(() => {
    if (!wideSearch) return niftyMatches;

    const niftySymbols = new Set(niftyMatches.map((m) => m.symbol));
    const deduped = nseResults.filter((r) => !niftySymbols.has(r.symbol));
    return [...niftyMatches, ...deduped];
  }, [wideSearch, niftyMatches, nseResults]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [matches.length]);

  useEffect(() => {
    if (listRef.current && highlightIndex >= 0) {
      const el = listRef.current.children[highlightIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  function handleSelect(stock: SearchResult) {
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
    query.length >= MIN_SEARCH_LENGTH &&
    matches.length === 0 &&
    !nseLoading;
  const showNseLoading =
    wideSearch && nseLoading && query.length >= MIN_SEARCH_LENGTH;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg animate-scale-in">
        <div className="overflow-hidden rounded-2xl bg-surface-raised ring-1 ring-surface-border/60 shadow-2xl shadow-black/50 card-elevated">
          {/* Search input */}
          <div className="relative border-b border-surface-border/40">
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
              placeholder={
                wideSearch
                  ? "Search all NSE stocks..."
                  : "Search Nifty 50 stocks..."
              }
              className="w-full bg-transparent py-4 pl-12 pr-16 text-base font-medium text-text-primary placeholder:text-text-muted outline-none"
            />
            <button
              onClick={onClose}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md ring-1 ring-surface-border px-1.5 py-0.5 font-mono text-[10px] font-semibold text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-secondary"
            >
              ESC
            </button>
          </div>

          {/* Wide search toggle */}
          <div className="flex items-center justify-between border-b border-surface-border/40 px-4 py-2.5">
            <button
              onClick={() => setWideSearch(!wideSearch)}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                wideSearch
                  ? "bg-accent/8 text-accent"
                  : "text-text-muted hover:bg-surface-overlay hover:text-text-secondary"
              }`}
            >
              <div
                className={`relative h-4 w-7 rounded-full transition-colors duration-200 ${
                  wideSearch ? "bg-accent" : "bg-surface-border"
                }`}
              >
                <div
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform duration-200 ${
                    wideSearch ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </div>
              Search beyond Nifty 50
            </button>
            {wideSearch && (
              <span className="text-[10px] text-text-muted animate-fade-in-fast font-medium">
                Server-assisted search
              </span>
            )}
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="max-h-72 overflow-y-auto scrollbar-thin"
          >
            {query.length === 0 && (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-overlay ring-1 ring-surface-border/50">
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
                <p className="font-display text-sm font-semibold text-text-secondary">
                  {wideSearch
                    ? "Search any NSE-listed stock"
                    : "Add a Nifty 50 stock to your watchlist"}
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

            {showNseLoading && matches.length === 0 && (
              <div className="px-4 py-8 text-center animate-fade-in-fast">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-overlay ring-1 ring-surface-border/50">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="animate-spin text-accent"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-text-secondary">
                  {searchMsg}
                </p>
              </div>
            )}

            {showNoResults && (
              <div className="px-4 py-6 text-center">
                <p className="font-display text-sm font-semibold text-text-secondary">
                  No matches found
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {wideSearch
                    ? "No matches \u2014 try a different spelling or symbol."
                    : "Try a different search term, or toggle on \u201CSearch beyond Nifty 50\u201D."}
                </p>
              </div>
            )}

            {matches.map((stock, i) => {
              const isFirst = i === 0;
              const prevSource = isFirst ? null : matches[i - 1].source;
              const showDivider =
                stock.source === "nse" && prevSource === "nifty50";

              return (
                <div key={`${stock.source}-${stock.symbol}`}>
                  {showDivider && (
                    <div className="flex items-center gap-2 px-4 py-2">
                      <div className="h-px flex-1 bg-surface-border/40" />
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                        Broader NSE
                      </span>
                      <div className="h-px flex-1 bg-surface-border/40" />
                    </div>
                  )}
                  <button
                    onClick={() => handleSelect(stock)}
                    onMouseEnter={() => setHighlightIndex(i)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      i === highlightIndex
                        ? "bg-accent/[0.06]"
                        : "hover:bg-surface-overlay/40"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold ring-1 ${
                        stock.source === "nse"
                          ? "bg-accent/8 text-accent/70 ring-accent/15"
                          : "bg-surface-overlay text-text-secondary ring-surface-border/50"
                      }`}
                    >
                      {stock.symbol.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-text-primary">
                          {highlightMatch(stock.symbol, query)}
                        </span>
                        {stock.source === "nse" && (
                          <span className="rounded-md bg-accent/8 ring-1 ring-accent/15 px-1 py-0.5 font-mono text-[9px] font-semibold text-accent/50">
                            NSE
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-text-muted">
                        {highlightMatch(stock.name, query)}
                      </p>
                    </div>
                    {i === highlightIndex && (
                      <span className="flex-shrink-0 rounded-lg bg-accent/10 ring-1 ring-accent/20 px-2.5 py-1 text-xs font-semibold text-accent">
                        Add
                      </span>
                    )}
                  </button>
                </div>
              );
            })}

            {showNseLoading && matches.length > 0 && (
              <div className="flex items-center justify-center gap-2 px-4 py-3 text-xs text-text-muted animate-fade-in-fast">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="animate-spin text-accent/50"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                {searchMsg}
              </div>
            )}
          </div>

          {/* Footer */}
          {matches.length > 0 && (
            <div className="flex items-center gap-4 border-t border-surface-border/40 px-4 py-2.5 text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <kbd className="rounded-md ring-1 ring-surface-border bg-surface-overlay px-1.5 py-0.5 font-mono text-[10px]">
                  &uarr;&darr;
                </kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded-md ring-1 ring-surface-border bg-surface-overlay px-1.5 py-0.5 font-mono text-[10px]">
                  &crarr;
                </kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded-md ring-1 ring-surface-border bg-surface-overlay px-1.5 py-0.5 font-mono text-[10px]">
                  esc
                </kbd>
                close
              </span>
              <span className="ml-auto font-mono tabular-nums">
                {matches.length} result{matches.length !== 1 ? "s" : ""}
                {nseLoading ? "+" : ""}
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
      <span className="text-accent font-bold">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}
