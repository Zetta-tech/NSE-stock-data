import { Dashboard } from "@/components/dashboard";
import { getWatchlist, getAlerts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [watchlist, alerts] = await Promise.all([
    getWatchlist(),
    getAlerts(),
  ]);

  return <Dashboard initialWatchlist={watchlist} initialAlerts={alerts} />;
}
