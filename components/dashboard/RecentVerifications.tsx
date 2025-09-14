// components/dashboard/RecentVerifications.tsx
"use client";

import { useEffect } from "react";
import useSWR, { mutate } from "swr";
import { logsService, swrFetcher } from "@/services/api";

interface Verification {
  inmate_id?: string;
  inmate_name?: string;
  officer_name?: string;
  score?: number; // expected 0..1 or 0..100
  recognized_at?: string;
}

const SWR_KEY = "/stats/recent-verifications?limit=5";

/**
 * Normalize various event shapes into our Verification type.
 * Backend WS events might be raw records, or wrapped as { payload: {...} }.
 */
function normalizeEvent(e: any): Verification {
  if (!e) return { inmate_name: "Unknown", officer_name: "Unknown", score: 0, recognized_at: new Date().toISOString() };

  const payload = e.payload ?? e;

  const inmate_name =
    payload.inmate_name ??
    payload.inmate?.name ??
    payload.inmate?.inmate_name ??
    payload.inmate?.display_name ??
    payload.name ??
    "Unknown";

  const officer_name =
    payload.officer_name ??
    payload.officer?.name ??
    payload.recognized_by_name ??
    "Unknown";

  // score may be string or number and either 0..1 or 0..100
  let score: number | undefined = undefined;
  if (payload.score !== undefined && payload.score !== null) {
    const s = typeof payload.score === "number" ? payload.score : parseFloat(payload.score);
    if (!Number.isNaN(s)) score = s;
  }

  const recognized_at =
    payload.recognized_at ?? payload.timestamp ?? payload.ts ?? new Date().toISOString();

  const inmate_id = payload.inmate_id ?? payload.inmate?.inmate_id ?? payload.inmate?.id ?? "";

  return { inmate_id, inmate_name, officer_name, score, recognized_at };
}

export default function RecentVerifications() {
  // SWR: fetch recent verifications from stats endpoint
  const { data } = useSWR<{ recent: Verification[] }>(SWR_KEY, swrFetcher, {
    refreshInterval: 0,
  });

  const recent: Verification[] = data?.recent ?? [];

  // Subscribe to live WS and update SWR cache on incoming events
  useEffect(() => {
    let mounted = true;
    const ws = logsService.connectLiveActivity((event: any) => {
      try {
        const ver = normalizeEvent(event);

        // Update SWR cache keyed by SWR_KEY
        mutate(
          SWR_KEY,
          (prev: { recent: Verification[] } | undefined) => {
            // Insert new item at top, keep up to 5
            const prevList = prev?.recent ?? [];
            // Avoid duplicates by recognized_at + inmate_id (simple heuristic)
            const isDuplicate = prevList.some(
              (p) =>
                p.recognized_at === ver.recognized_at &&
                (p.inmate_id && ver.inmate_id ? p.inmate_id === ver.inmate_id : false)
            );
            if (isDuplicate) return prev ?? { recent: prevList };

            const merged = [ver, ...prevList].slice(0, 5);
            return { recent: merged };
          },
          false // don't revalidate immediately
        );
      } catch (err) {
        console.error("Failed to handle live verification event:", err);
      }
    });

    return () => {
      mounted = false;
      try {
        ws?.close();
      } catch (e) {
        /* ignore */
      }
    };
  }, []);

  const formatScore = (s?: number) => {
    if (s === undefined || s === null || Number.isNaN(s)) return "-";
    // if s looks like 0..1, convert to percent; if >1 assume percent already
    const percent = s <= 1 ? s * 100 : s;
    return `${percent.toFixed(1)}%`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-4">Recent Verifications</h2>
      <ul className="space-y-3">
        {recent.length === 0 ? (
          <li className="text-gray-500 text-sm">No recent verifications</li>
        ) : (
          recent.map((item, idx) => (
            <li
              key={`${item.inmate_id ?? "unknown"}-${idx}`}
              className="flex justify-between items-center border-b last:border-b-0 pb-2"
            >
              <div>
                <p className="font-medium">{item.inmate_name ?? item.inmate_id ?? "Unknown"}</p>
                <p className="text-xs text-gray-500">
                  By {item.officer_name ?? "Unknown"} —{" "}
                  {item.recognized_at ? new Date(item.recognized_at).toLocaleString() : "Unknown time"}
                </p>
              </div>
              <span className="text-sm text-gray-600">{formatScore(item.score)}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
