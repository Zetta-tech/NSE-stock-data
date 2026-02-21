/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  makeDiscovery,
  makeNifty50TableResponse,
  makeSnapshot,
  makeSnapshotStock,
} from "@/test-utils/fixtures";

const { isMarketHoursMock, isExtendedHoursMock } = vi.hoisted(() => ({
  isMarketHoursMock: vi.fn(),
  isExtendedHoursMock: vi.fn(),
}));

vi.mock("@/lib/market-hours", () => ({
  isMarketHours: isMarketHoursMock,
  isExtendedHours: isExtendedHoursMock,
}));

import { Nifty50Table } from "./nifty50-table";

const THREE_MINUTES_MS = 3 * 60_000;

function okResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe("Nifty50 table UI contracts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    isExtendedHoursMock.mockReturnValue(true);
    isMarketHoursMock.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("auto-refreshes every three minutes only while market is open", async () => {
    // Contract: open market should keep table fresh on a 3-minute cadence.
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse(makeNifty50TableResponse()),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<Nifty50Table />);
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(THREE_MINUTES_MS);
    });
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("does not poll every three minutes when market is closed", async () => {
    // Contract: closed market should avoid background polling and rely on cached/manual refresh.
    isMarketHoursMock.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse(makeNifty50TableResponse({ marketOpen: false })),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<Nifty50Table />);
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(THREE_MINUTES_MS);
    });
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("runs a manual refresh immediately when user clicks Refresh", async () => {
    // Contract: manual refresh should always trigger a fetch regardless of polling state.
    isMarketHoursMock.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse(makeNifty50TableResponse({ marketOpen: false })),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<Nifty50Table />);
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("shows stale and possible labels without claiming breakout confirmed", async () => {
    // Contract: degraded data must never be presented as confirmed breakout.
    isMarketHoursMock.mockReturnValue(false);
    const payload = makeNifty50TableResponse({
      snapshot: makeSnapshot({
        stale: true,
        fetchSuccess: false,
        stocks: [
          makeSnapshotStock({ symbol: "TCS", name: "TCS" }),
          makeSnapshotStock({ symbol: "ITC", name: "ITC" }),
        ],
      }),
      discoveries: [
        makeDiscovery({
          symbol: "TCS",
          name: "TCS",
          possibleBreakout: true,
          breakout: false,
        }),
        makeDiscovery({
          symbol: "ITC",
          name: "ITC",
          baselineUnavailable: true,
          breakout: false,
        }),
      ],
      marketOpen: false,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(payload)));

    render(<Nifty50Table />);
    await flushAsyncWork();

    expect(screen.getByText("Possible")).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
    expect(screen.getByText("No baseline")).toBeInTheDocument();
    expect(screen.queryByText(/breakout.*confirmed/i)).not.toBeInTheDocument();
  });
});
