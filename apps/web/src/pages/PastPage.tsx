import { useQuery } from "@tanstack/react-query";
import { listConferences } from "../api";
import { ConferenceList } from "../components/ConferenceList";

export function PastPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["conferences", "past"],
    queryFn: () => listConferences("past"),
  });
  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="text-rose-700">Failed to load.</p>;
  return <ConferenceList conferences={data!} showOnlineToggle showYearFilter />;
}
