export function subscribeDashboard(onMessage: (event: MessageEvent) => void, onStatus?: (connected: boolean) => void) {
  let stopped = false;
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  const retry = () => {
    onStatus?.(false);
    if (!stopped) timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retries++));
  };
  const connect = async () => {
    try {
      const response = await fetch("/api/dashboard-ticket", { method: "POST" });
      if (!response.ok) throw new Error("Stream authentication failed");
      const { data } = await response.json();
      if (stopped) return;
      socket = new WebSocket(`${data.url}/dashboard-stream?ticket=${data.ticket}`);
      socket.onopen = () => { retries = 0; onStatus?.(true); };
      socket.onmessage = onMessage;
      socket.onclose = retry;
      socket.onerror = () => socket?.close();
    } catch { retry(); }
  };
  void connect();
  return () => { stopped = true; clearTimeout(timer); socket?.close(); };
}
