import { useEffect, useRef, useState } from "react";

type Event =
  | { type: "NODE_ONLINE"; nodeId: string; time: string }
  | { type: "NODE_OFFLINE"; nodeId: string; time: string }
  | { type: "LOG"; nodeId: string; payload: string; time: string }
  | { type: "TELEMETRY"; nodeId: string; payload: any; time: string };

export function useDashboardStream() {
  const [events, setEvents] = useState<Event[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = process.env.NEXT_PUBLIC_BROKER_WS_HOST || "api.hivenode.alfastage.com.br";
    const ws = new WebSocket(`${protocol}://${host}/dashboard-stream`);
    wsRef.current = ws;
    
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // auto-reconnect exponencial
      setTimeout(() => wsRef.current?.close(), 2000);
    };
    ws.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as Event;
        setEvents(prev => [ev, ...prev].slice(0, 200));
      } catch {}
    };
    
    return () => ws.close();
  }, []);
  
  return { events, connected };
}
