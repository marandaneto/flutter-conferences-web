import { useQuery } from "@tanstack/react-query";
import { listConferences } from "../api";
import { ConferenceItem } from "../components/ConferenceItem";

export function PastPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["conferences", "past"],
    queryFn: () => listConferences("past"),
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
