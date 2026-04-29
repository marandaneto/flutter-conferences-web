import { useQuery } from "@tanstack/react-query";
import { listConferences } from "../api";
import { ConferenceList } from "../components/ConferenceList";

export function OnlinePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["conferences", "online"],
    queryFn: () => listConferences("online"),
  });
  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="text-rose-700">Failed to load.</p>;
  return <ConferenceList conferences={data!} />;
}
