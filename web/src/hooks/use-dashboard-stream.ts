import { useEffect, useState } from "react";
import { subscribeDashboard } from "@/lib/dashboard-client";
type Event = { type: string; nodeId: string; payload?: unknown; time: string };
export function useDashboardStream() {
  const [events, setEvents] = useState<Event[]>([]);
  const [connected, setConnected] = useState(false);
  useEffect(() => subscribeDashboard(event => {
    try { const value = JSON.parse(event.data); setEvents(previous => [value, ...previous].slice(0, 200)); } catch {}
  }, setConnected), []);
  return { events, connected };
}
