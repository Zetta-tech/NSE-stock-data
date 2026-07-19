import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import MaintenancePage from "@/app/maintenance/page";
import {
  getMaintenanceDisposition,
  MAINTENANCE_MESSAGE,
  MAINTENANCE_MODE,
} from "@/maintenance";

describe("maintenance policy", () => {
  test("keeps maintenance mode active", () => {
    expect(MAINTENANCE_MODE).toBe(true);
  });

  test.each(["/maintenance", "/maintenance/"])(
    "allows the maintenance page at %s",
    (pathname) => {
      expect(getMaintenanceDisposition(pathname)).toBe(
        "allow-maintenance-page",
      );
    },
  );

  test.each([
    "/api",
    "/api/state",
    "/api/auth",
    "/api/register",
    "/api/admin/lockdown",
    "/api/admin/registrations",
  ])("makes %s unavailable", (pathname) => {
    expect(getMaintenanceDisposition(pathname)).toBe("service-unavailable");
  });

  test.each(["/", "/login", "/lockdown", "/dev", "/analyze/INFY"])(
    "redirects the page surface %s",
    (pathname) => {
      expect(getMaintenanceDisposition(pathname)).toBe("redirect");
    },
  );

  test("renders neutral public copy", () => {
    const html = renderToStaticMarkup(<MaintenancePage />);

    expect(html).toContain("Maintenance in progress");
    expect(html).toContain(MAINTENANCE_MESSAGE);
    expect(html.toLowerCase()).not.toMatch(
      /redis|upstash|migration|infrastructure|outage/,
    );
  });
});
