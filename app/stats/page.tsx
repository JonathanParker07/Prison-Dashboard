"use client";

import { useEffect, useState } from "react";
import { logsService } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
);

type RawDist = { _id?: string; name?: string; count: number };
type Dist = { _id: string; count: number };

const BAR_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
  "#06b6d4",
  "#a855f7",
  "#f97316",
  "#8b5cf6",
  "#14b8a6",
];

/**
 * Normalize + merge distribution entries:
 * - Accepts array of { _id | name, count }
 * - Trims, collapses case/whitespace differences, merges counts for same logical label
 * - Returns array of { _id: DisplayLabel, count } sorted descending by count
 *
 * Heuristics:
 * - Empty -> "Unknown"
 * - Lowercased key used for grouping
 * - If key looks like an age-range (starts with digit or contains '-'), keep as-is for display
 * - Title-case otherwise (first letter uppercase, rest lowercase)
 * - Basic synonym mapping can be extended here if needed
 */
const normalizeAndMerge = (arr?: RawDist[]): Dist[] => {
  const grouped: Record<string, number> = {};
  if (!arr || !Array.isArray(arr)) return [];

  // small synonyms map for common variants (extend as needed)
  const synonyms: Record<string, string> = {
    // map common variations to canonical key (all lowercased)
    "sentenced": "sentenced",
    "convicted": "sentenced",
    "awaiting trial": "awaiting trial",
    "awaiting_trial": "awaiting trial",
    "remand": "remand",
    "unknown": "unknown",
  };

  arr.forEach(({ _id, name, count }) => {
    let raw = (_id ?? name ?? "").toString().trim();
    if (!raw) raw = "Unknown";

    // normalize spaces and unify whitespace
    raw = raw.replace(/\s+/g, " ");

    // group key = lowercased
    let key = raw.toLowerCase();

    // apply simple synonym normalization (if matches)
    if (synonyms[key]) key = synonyms[key];

    grouped[key] = (grouped[key] || 0) + (count || 0);
  });

  // build display entries
  const entries: Dist[] = Object.entries(grouped).map(([key, count]) => {
    // prepare display label
    let display: string;
    if (!key || key === "unknown") {
      display = "Unknown";
    } else if (/^[\d]/.test(key) || key.includes("-")) {
      // age ranges like "0-20" or numeric-first labels -> keep as-is (but respect original casing)
      display = key;
    } else {
      // title-case (first letter upper, rest lower)
      display = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
    }
    return { _id: display, count };
  });

  // sort descending by count for better chart ordering
  entries.sort((a, b) => b.count - a.count);

  return entries;
};

export default function StatsPage() {
  const [dailyData, setDailyData] = useState<{ _id: string; count: number }[]>([]);
  const [topInmates, setTopInmates] = useState<{ inmate: string; count: number }[]>([]);
  const [byOfficer, setByOfficer] = useState<{ officer: string; count: number }[]>([]);
  const [ageDistribution, setAgeDistribution] = useState<Dist[]>([]);
  const [legalStatusDistribution, setLegalStatusDistribution] = useState<Dist[]>([]);
  const [facilityDistribution, setFacilityDistribution] = useState<Dist[]>([]);
  const [sexDistribution, setSexDistribution] = useState<Dist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      setLoading(true);
      try {
        const [
          daily,
          top,
          officers,
          ageDist,
          legalDist,
          facilityDist,
          sexDist,
        ] = await Promise.all([
          logsService.getDailyRecognitions(7),
          logsService.getTopInmates(30),
          logsService.getRecognitionsByOfficer(),
          logsService.getAgeDistribution(),
          logsService.getLegalStatusDistribution(),
          logsService.getFacilityDistribution(),
          logsService.getSexDistribution(),
        ]);

        if (!mounted) return;

        setDailyData(daily?.daily ?? []);
        setTopInmates(top?.top_inmates ?? []);
        setByOfficer(officers?.by_officer ?? []);

        // normalize + merge all distributions to avoid duplicate sectors (like "sentenced" vs "Sentenced ")
        setAgeDistribution(normalizeAndMerge(ageDist?.age_distribution));
        setLegalStatusDistribution(normalizeAndMerge(legalDist?.legal_status_distribution));
        setFacilityDistribution(normalizeAndMerge(facilityDist?.facility_distribution));
        setSexDistribution(normalizeAndMerge(sexDist?.sex_distribution));
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  // Chart configs
  const lineData = {
    labels: dailyData.map((d) => d._id),
    datasets: [
      {
        label: "Recognitions",
        data: dailyData.map((d) => d.count),
        borderColor: "#3b82f6",
        backgroundColor: "#3b82f6",
        tension: 0.3,
      },
    ],
  };

  const topInmatesData = {
    labels: topInmates.map((i) => i.inmate),
    datasets: [
      {
        label: "Recognitions",
        data: topInmates.map((i) => i.count),
        backgroundColor: "#10b981",
      },
    ],
  };

  const officerData = {
    labels: byOfficer.map((o) => o.officer),
    datasets: [
      {
        label: "Recognitions",
        data: byOfficer.map((o) => o.count),
        backgroundColor: [
          "#f59e0b",
          "#6366f1",
          "#ef4444",
          "#06b6d4",
          "#a855f7",
          "#10b981",
        ],
      },
    ],
  };

  const generatePieData = (data: Dist[], label: string, colors?: string[]) => ({
    labels: data.map((d) => d._id),
    datasets: [
      {
        label,
        data: data.map((d) => d.count),
        backgroundColor:
          colors ?? [
            "#3b82f6",
            "#10b981",
            "#f59e0b",
            "#ef4444",
            "#6366f1",
            "#06b6d4",
            "#a855f7",
            "#f97316",
            "#8b5cf6",
            "#14b8a6",
          ],
      },
    ],
  });

  const ageData = generatePieData(ageDistribution, "Age Distribution");
  const legalStatusData = generatePieData(legalStatusDistribution, "Legal Status Distribution");
  const sexData = generatePieData(sexDistribution, "Sex Distribution", ["#3b82f6", "#ef4444"]);

  // --- Facility column chart data & options (vertical columns) ---
  const facilityBarData = {
    labels: facilityDistribution.map((d) => d._id),
    datasets: [
      {
        label: "Inmates",
        data: facilityDistribution.map((d) => d.count),
        backgroundColor: facilityDistribution.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]),
      },
    ],
  };

  const facilityOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
  };

  const placeholder = (height = 160) => (
    <div style={{ height }} className="w-full rounded bg-gray-100 animate-pulse" />
  );

  return (
    <div className="p-6 space-y-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Line Chart */}
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Daily Recognitions</CardTitle>
        </CardHeader>
        <CardContent>{loading ? placeholder(200) : <Line data={lineData} />}</CardContent>
      </Card>

      {/* Top Inmates */}
      <Card>
        <CardHeader>
          <CardTitle>Top Recognized Inmates</CardTitle>
        </CardHeader>
        <CardContent>{loading ? placeholder(200) : <Bar data={topInmatesData} />}</CardContent>
      </Card>

      {/* Officers */}
      <Card>
        <CardHeader>
          <CardTitle>Recognitions by Officer</CardTitle>
        </CardHeader>
        <CardContent>{loading ? placeholder(200) : <Pie data={officerData} />}</CardContent>
      </Card>

      {/* Age */}
      <Card>
        <CardHeader>
          <CardTitle>Age Distribution</CardTitle>
        </CardHeader>
        <CardContent>{loading ? placeholder(200) : <Pie data={ageData} />}</CardContent>
      </Card>

      {/* Sex - newly added */}
      <Card>
        <CardHeader>
          <CardTitle>Sex Distribution</CardTitle>
        </CardHeader>
        <CardContent>{loading ? placeholder(200) : <Pie data={sexData} />}</CardContent>
      </Card>

      {/* Legal Status */}
      <Card>
        <CardHeader>
          <CardTitle>Legal Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>{loading ? placeholder(200) : <Pie data={legalStatusData} />}</CardContent>
      </Card>

      {/* Facility -> Column (vertical bar) chart */}
      <Card>
        <CardHeader>
          <CardTitle>Facility Distribution</CardTitle>
        </CardHeader>
        <CardContent style={{ minHeight: 240 }}>
          {loading ? placeholder(240) : <Bar data={facilityBarData} options={facilityOptions} />}
        </CardContent>
      </Card>
    </div>
  );
}
