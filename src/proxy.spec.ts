import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  MAINTENANCE_MESSAGE,
  MAINTENANCE_RETRY_AFTER_SECONDS,
} from "@/maintenance";

const mocks = vi.hoisted(() => ({
  getSecurityState: vi.fn(),
  isLockdownExpired: vi.fn(),
  setSecurityState: vi.fn(),
}));

vi.mock("@/lib/lockdown", () => ({
  getSecurityState: mocks.getSecurityState,
  isLockdownExpired: mocks.isLockdownExpired,
  setSecurityState: mocks.setSecurityState,
}));

import { proxy } from "./proxy";

const makeRequest = (pathname: string) =>
  new NextRequest(new URL(pathname, "https://tickzy.dev"));

describe("maintenance request gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test.each([
    "/api/state",
    "/api/auth",
    "/api/register",
    "/api/admin/sessions",
    "/api/admin/registrations",
  ])("returns a neutral 503 for %s without reading private state", async (path) => {
    const response = await proxy(makeRequest(path));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: MAINTENANCE_MESSAGE,
    });
    expect(response.headers.get("cache-control")).toBe(
      "no-store, max-age=0",
    );
    expect(response.headers.get("retry-after")).toBe(
      String(MAINTENANCE_RETRY_AFTER_SECONDS),
    );
    expect(mocks.getSecurityState).not.toHaveBeenCalled();
  });

  test.each(["/", "/login", "/lockdown", "/dev", "/analyze/INFY"])(
    "redirects %s without reading private state",
    async (path) => {
      const response = await proxy(makeRequest(path));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "https://tickzy.dev/maintenance",
      );
      expect(response.headers.get("cache-control")).toBe(
        "no-store, max-age=0",
      );
      expect(mocks.getSecurityState).not.toHaveBeenCalled();
    },
  );

  test("allows only the maintenance page through without reading private state", async () => {
    const response = await proxy(makeRequest("/maintenance"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.getSecurityState).not.toHaveBeenCalled();
  });
});
