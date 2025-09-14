"use client";

import useSWR, { mutate } from "swr";
import { logsService, swrFetcher } from "@/services/api";

interface ActivityItem {
  inmate_id: string;
  inmate_name: string;
  officer_name: string;
  score: number;
  recognized_at: string;
}

export default function LiveActivityFeed() {
  // ✅ SWR handles fetching + cache
  const { data } = useSWR<{ recent: ActivityItem[] }>(
    "/logs/recent?limit=20",
    swrFetcher,
    { refreshInterval: 0 }
  );

  const activities: ActivityItem[] = data?.recent ?? [];

  // ✅ Subscribe to WebSocket for live updates
  useSWR("live-activity-ws", () => {
    const ws = logsService.connectLiveActivity((event: ActivityItem) => {
      mutate(
        "/logs/recent?limit=20",
        (prev: { recent: ActivityItem[] } | undefined) => {
          if (!prev) return { recent: [event] };
          return { recent: [event, ...prev.recent].slice(0, 20) };
        },
        false
      );
    });
    return () => ws.close();
  });

  return (
    <div className="bg-white rounded-lg shadow p-4 h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Live Activity Feed</h2>
        <span
          className={`h-3 w-3 rounded-full ${
            activities.length > 0 ? "bg-green-500" : "bg-gray-400"
          }`}
          title={activities.length > 0 ? "Receiving updates" : "Waiting..."}
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {activities.length === 0 ? (
          <p className="text-gray-500 text-sm">No live activity yet</p>
        ) : (
          activities.map((item, idx) => (
            <div
              key={`${item.inmate_id}-${idx}`}
              className="border-b last:border-b-0 pb-2 text-sm text-gray-700"
            >
              <p className="font-medium">
                {item.inmate_name || "Unknown"}{" "}
                <span className="text-xs text-gray-500">
                  ({(item.score * 100).toFixed(1)}%)
                </span>
              </p>
              <p className="text-xs text-gray-500">
                By {item.officer_name || "Unknown"} —{" "}
                {new Date(item.recognized_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
