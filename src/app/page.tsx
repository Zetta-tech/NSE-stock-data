import { Dashboard } from "@/components/dashboard";
import { getWatchlist, getAlerts, getScanResults } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [watchlist, alerts, scanResults] = await Promise.all([
    getWatchlist(),
    getAlerts(),
    getScanResults(),
  ]);

  return (
    <Dashboard
      initialWatchlist={watchlist}
      initialAlerts={alerts}
      initialResults={scanResults}
    />
  );
}
