import { Dashboard } from "@/components/dashboard";
import { getWatchlist, getAlerts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function Home() {
  const watchlist = getWatchlist();
  const alerts = getAlerts();

  return <Dashboard initialWatchlist={watchlist} initialAlerts={alerts} />;
}
