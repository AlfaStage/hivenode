"use client";

import { useDashboardStream } from "@/hooks/use-dashboard-stream";
import { cn } from "@/lib/utils";

export function DashboardLiveBadge() {
  const { connected } = useDashboardStream();

  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", connected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
      <span className="text-xs text-muted-foreground">
        {connected ? "Ao vivo" : "Reconectando..."}
      </span>
    </div>
  );
}
