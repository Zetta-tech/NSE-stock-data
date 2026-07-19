export const MAINTENANCE_PATH = "/maintenance";
export const MAINTENANCE_MESSAGE =
  "This application is currently under maintenance. Please check back soon.";
export const MAINTENANCE_RETRY_AFTER_SECONDS = 3600;
export const MAINTENANCE_MODE = true;

export type MaintenanceDisposition =
  | "allow-maintenance-page"
  | "service-unavailable"
  | "redirect";

export const getMaintenanceDisposition = (
  pathname: string,
): MaintenanceDisposition | null => {
  if (!MAINTENANCE_MODE) {
    return null;
  }

  if (pathname === MAINTENANCE_PATH || pathname === `${MAINTENANCE_PATH}/`) {
    return "allow-maintenance-page";
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return "service-unavailable";
  }

  return "redirect";
};
