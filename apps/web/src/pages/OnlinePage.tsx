import { useQuery } from "@tanstack/react-query";
import { listConferences } from "../api";
import { ConferenceItem } from "../components/ConferenceItem";

export function OnlinePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["conferences", "online"],
    queryFn: () => listConferences("online"),
  });
  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="text-rose-700">Failed to load.</p>;
  return (
    <ul className="divide-y divide-slate-200">
      {data!.map((c) => (
        <ConferenceItem key={c.id} c={c} />
      ))}
    </ul>
  );
}
