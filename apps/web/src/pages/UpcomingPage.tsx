import { useQuery } from "@tanstack/react-query";
import { listConferences } from "../api";
import { ConferenceList } from "../components/ConferenceList";

export function UpcomingPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["conferences", "upcoming"],
    queryFn: () => listConferences("upcoming"),
  });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="text-rose-700">Failed to load.</p>;
  return <ConferenceList conferences={data!} showOnlineToggle />;
}
