"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie as RechartsPie,
  Cell as RechartsCell,
  LabelList,
} from "recharts";

import { Pie, Bar as ChartBar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
  Title,
  ChartOptions,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

import { logsService } from "@/services/api";
import type {
  DailyRecognition,
  TopInmate,
  OfficerRecognition,
  DistributionEntry,
} from "@/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  ChartTooltip,
  Legend,
  Title,
  ChartDataLabels
);

const COLORS = [
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

// --- Normalization function with deduplication ---
function normalizeEntries(arr?: DistributionEntry[]) {
  const seen = new Map<string, { label: string; count: number }>();

  (arr ?? []).forEach((e) => {
    const raw = (("name" in e ? (e as any).name : (e as any)._id) ?? "")
      .toString()
      .trim();

    // Normalize key for uniqueness (lowercase + trimmed)
    const key = raw.toLowerCase();
    const display = raw !== "" ? raw : "Unknown";
    const count = (e as any).count ?? 0;

    if (seen.has(key)) {
      seen.get(key)!.count += count; // merge duplicate buckets
    } else {
      seen.set(key, { label: display, count });
    }
  });

  return Array.from(seen.values());
}

function generateChartData(entries: { label: string; count: number }[]) {
  const labels = entries.map((e) => e.label);
  const data = entries.map((e) => e.count);
  const backgroundColor = entries.map((_, i) => COLORS[i % COLORS.length]);
  return { labels, datasets: [{ label: "Count", data, backgroundColor }] };
}

const pieOptions: ChartOptions<"pie"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "right",
      labels: { boxWidth: 12, padding: 8 },
    },
    datalabels: {
      color: "#fff",
      font: { weight: 600 },
      formatter: (value: number, ctx: any) => {
        const label = ctx.chart.data.labels?.[ctx.dataIndex] ?? "";
        const dataset = ctx.chart.data.datasets?.[0];
        const total = Array.isArray(dataset?.data)
          ? (dataset.data as number[]).reduce((s, n) => s + (Number(n) || 0), 0)
          : 0;
        const percent = total > 0 ? Math.round(((Number(value) || 0) / total) * 100) : 0;
        return `${label}: ${value} (${percent}%)`;
      },
      anchor: "center",
      align: "center",
      clamp: true,
    },
  } as any,
  elements: { arc: { borderWidth: 1 } },
};

export default function LogsPage() {
  const [dailyData, setDailyData] = useState<DailyRecognition[]>([]);
  const [topInmates, setTopInmates] = useState<TopInmate[]>([]);
  const [officerData, setOfficerData] = useState<OfficerRecognition[]>([]);

  const [ageDistribution, setAgeDistribution] = useState<DistributionEntry[]>([]);
  const [legalStatusDistribution, setLegalStatusDistribution] = useState<DistributionEntry[]>([]);
  const [facilityDistribution, setFacilityDistribution] = useState<DistributionEntry[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAllData = async () => {
    try {
      setIsLoading(true);

      const [
        dailyResponse,
        topResponse,
        officerResponse,
        ageDistResponse,
        legalStatusDistResponse,
        facilityDistResponse,
      ] = await Promise.all([
        logsService.getDailyRecognitions(7),
        logsService.getTopInmates(30),
        logsService.getRecognitionsByOfficer(),
        logsService.getAgeDistribution(),
        logsService.getLegalStatusDistribution(),
        logsService.getFacilityDistribution(),
      ]);

      setDailyData(dailyResponse.daily || []);
      setTopInmates(topResponse.top_inmates || []);
      setOfficerData(officerResponse.by_officer || []);

      setAgeDistribution(ageDistResponse.age_distribution || []);
      setLegalStatusDistribution(legalStatusDistResponse.legal_status_distribution || []);
      setFacilityDistribution(facilityDistResponse.facility_distribution || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load analytics data");
    } finally {
      setIsLoading(false);
    }
  };

  const totalRecognitions = dailyData.reduce((sum, day) => sum + day.count, 0);
  const avgDaily = dailyData.length > 0 ? totalRecognitions / dailyData.length : 0;

  if (isLoading) return <div>Loading analytics...</div>;

  // Normalize + dedupe
  const normalizedAge = normalizeEntries(ageDistribution);
  const normalizedLegal = normalizeEntries(legalStatusDistribution);
  const normalizedFacility = normalizeEntries(facilityDistribution);

  const ageData = generateChartData(normalizedAge);
  const legalData = generateChartData(normalizedLegal);
  const facilityData = generateChartData(normalizedFacility);

  // Facility bar chart
  const facilityBarData = {
    labels: normalizedFacility.map((d) => d.label),
    datasets: [
      {
        label: "Inmates",
        data: normalizedFacility.map((d) => d.count),
        backgroundColor: normalizedFacility.map((_, i) => COLORS[i % COLORS.length]),
      },
    ],
  };

  const facilityBarOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      datalabels: {
        anchor: "end",
        align: "end",
        color: "#000",
        font: { weight: 600 },
        formatter: (value: number) => (value ? value : ""),
      },
    } as any,
    scales: {
      x: {
        ticks: { maxRotation: 45, minRotation: 0, autoSkip: true },
        grid: { display: false },
      },
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  const renderChartJsPie = (data: any) => (
    <div style={{ height: 300 }}>
      <Pie data={data} options={pieOptions} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <BarChart3 className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Logs & Statistics</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recognitions (7 days)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRecognitions}</div>
            <p className="text-xs text-muted-foreground">{avgDaily.toFixed(1)} per day average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Inmates (30 days)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topInmates.length}</div>
            <p className="text-xs text-muted-foreground">{topInmates[0]?.inmate || "N/A"} most recognized</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Officers</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{officerData.length}</div>
            <p className="text-xs text-muted-foreground">{officerData[0]?.officer || "N/A"} most active</p>
          </CardContent>
        </Card>
      </div>

      {/* Recharts charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daily Recognitions (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                <YAxis />
                <RechartsTooltip labelFormatter={(v) => new Date(v).toLocaleDateString()} />
                <Bar dataKey="count" fill="#8884d8">
                  <LabelList dataKey="count" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Inmates (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <RechartsPie
                  data={topInmates.slice(0, 5)}
                  dataKey="count"
                  nameKey="inmate"
                  cx="50%"
                  cy="50%"
                  innerRadius={10}
                  outerRadius={90}
                  label={({ inmate, percent }) => `${inmate} (${Math.round((percent ?? 0) * 100)}%)`}
                >
                  {topInmates.slice(0, 5).map((_, idx) => (
                    <RechartsCell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </RechartsPie>
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* New distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Age Distribution</CardTitle>
          </CardHeader>
          <CardContent>{normalizedAge.length ? renderChartJsPie(ageData) : <div>No data</div>}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Legal Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>{normalizedLegal.length ? renderChartJsPie(legalData) : <div>No data</div>}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facility Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {normalizedFacility.length ? (
              <div style={{ height: 300 }}>
                <ChartBar data={facilityBarData} options={facilityBarOptions} />
              </div>
            ) : (
              <div>No data</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
