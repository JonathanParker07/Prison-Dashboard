"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { inmatesService, logsService, officersService } from "@/services/api";
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
  ChartOptions,
} from "chart.js";
import { Users, Shield, Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import RecentVerifications from "@/components/dashboard/RecentVerifications";
import LiveActivityFeed from "@/components/dashboard/LiveActivityFeed";

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

type DistributionEntry = { _id?: string; name?: string; count: number };

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

// normalize + merge duplicates
const mapDist = (arr: DistributionEntry[]) => {
  const grouped: Record<string, number> = {};

  (arr ?? []).forEach(({ _id, name, count }) => {
    let label = (_id || name || "Unknown").toString().trim();
    if (!label) label = "Unknown";
    label = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
    grouped[label] = (grouped[label] || 0) + (count || 0);
  });

  return Object.entries(grouped).map(([label, count]) => ({ _id: label, count }));
};

export default function DashboardPage() {
  const { user, sessionReady } = useAuth();
  const router = useRouter();

  const [inmateCount, setInmateCount] = useState(0);
  const [officerCount, setOfficerCount] = useState(0);
  const [todayRecognitions, setTodayRecognitions] = useState(0);

  const [dailyData, setDailyData] = useState<{ _id: string; count: number }[]>([]);
  const [topInmates, setTopInmates] = useState<{ inmate: string; count: number }[]>([]);
  const [byOfficer, setByOfficer] = useState<{ officer: string; count: number }[]>([]);

  const [ageDist, setAgeDist] = useState<{ _id: string; count: number }[]>([]);
  const [sexDist, setSexDist] = useState<{ _id: string; count: number }[]>([]);
  const [legalDist, setLegalDist] = useState<{ _id: string; count: number }[]>([]);
  const [facilityDist, setFacilityDist] = useState<{ _id: string; count: number }[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        // Inmates
        const inmates = await inmatesService.getInmates();
        setInmateCount(inmates?.length ?? 0);

        // Officers count
        try {
          const totalOfficers = await officersService.getTotalOfficers?.();
          if (typeof totalOfficers === "number") {
            setOfficerCount(totalOfficers);
          } else {
            const maybe = await officersService.getAll?.();
            if (Array.isArray(maybe)) {
              const uniqueEmails = new Set(
                maybe
                  .map((o: any) => (o?.email ?? "").toString().trim().toLowerCase())
                  .filter(Boolean)
              );
              setOfficerCount(uniqueEmails.size);
            }
          }
        } catch (e) {
          console.warn("officers count failed, falling back to getAll()", e);
          try {
            const maybe = await officersService.getAll?.();
            if (Array.isArray(maybe)) {
              const uniqueEmails = new Set(
                maybe
                  .map((o: any) => (o?.email ?? "").toString().trim().toLowerCase())
                  .filter(Boolean)
              );
              setOfficerCount(uniqueEmails.size);
            }
          } catch (e2) {
            console.warn("Failed to fetch full officers list as fallback:", e2);
          }
        }

        // Today's recognitions
        try {
          const todayResp = await logsService.getRecognitionsTodayByOfficer();
          setTodayRecognitions(todayResp?.count ?? 0);
        } catch (e) {
          console.warn("Failed to fetch recognitions-today-by-officer:", e);
          setTodayRecognitions(0);
        }

        // Parallel requests
        const [
          dailyResp,
          topResp,
          officersResp,
          ageResp,
          sexResp,
          legalResp,
          facilityResp,
        ] = await Promise.all([
          logsService.getDailyRecognitions(7),
          logsService.getTopInmates(30),
          logsService.getRecognitionsByOfficer(),
          logsService.getAgeDistribution(),
          logsService.getSexDistribution(),
          logsService.getLegalStatusDistribution(),
          logsService.getFacilityDistribution(),
        ]);

        setDailyData(dailyResp?.daily ?? []);
        setTopInmates(topResp?.top_inmates ?? []);
        setByOfficer(officersResp?.by_officer ?? []);

        setAgeDist(mapDist(ageResp?.age_distribution ?? []));
        setSexDist(mapDist(sexResp?.sex_distribution ?? []));
        setLegalDist(mapDist(legalResp?.legal_status_distribution ?? []));
        setFacilityDist(mapDist(facilityResp?.facility_distribution ?? []));
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    }

    if (sessionReady) fetchStats();
  }, [sessionReady]);

  if (!sessionReady) return <div className="p-6">Loading session...</div>;

  const summaryCards = [
    { title: "Total Inmates", value: inmateCount, icon: Users, color: "bg-blue-500" },
    { title: "Total Officers", value: officerCount, icon: Shield, color: "bg-green-500" },
    { title: "Recognitions Today", value: todayRecognitions, icon: Camera, color: "bg-yellow-500" },
  ];

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
        backgroundColor: ["#f59e0b", "#6366f1", "#ef4444", "#06b6d4", "#a855f7"],
      },
    ],
  };

  const ageData = {
    labels: ageDist.map((a) => a._id || "Unknown"),
    datasets: [
      {
        label: "Inmates",
        data: ageDist.map((a) => a.count),
        backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
      },
    ],
  };

  const sexData = {
    labels: sexDist.map((s) => s._id || "Unknown"),
    datasets: [
      {
        label: "Inmates",
        data: sexDist.map((s) => s.count),
        backgroundColor: ["#6366f1", "#f43f5e", "#22c55e"],
      },
    ],
  };

  const legalData = {
    labels: legalDist.map((l) => l._id || "Unknown"),
    datasets: [
      {
        label: "Inmates",
        data: legalDist.map((l) => l.count),
        backgroundColor: ["#6366f1", "#f43f5e", "#22c55e", "#eab308"],
      },
    ],
  };

  const facilityBarData = {
    labels: facilityDist.map((f) => f._id || "Unknown"),
    datasets: [
      {
        label: "Inmates",
        data: facilityDist.map((f) => f.count),
        backgroundColor: facilityDist.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]),
      },
    ],
  };

  const facilityBarOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      x: {
        ticks: { maxRotation: 45, minRotation: 0, autoSkip: true },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
      },
    },
  };

  const chartCardClass = "cursor-pointer hover:shadow-lg transition";

  const placeholder = (height = 160) => (
    <div style={{ height }} className="w-full rounded bg-gray-100 animate-pulse" />
  );

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user?.name || "Officer"}</h1>
        <p className="text-gray-500">Here’s an overview of today’s activity.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summaryCards.map((card) => (
          <Card key={card.title} className="flex items-center p-4">
            <div className={`${card.color} p-3 rounded-full text-white`}>
              <card.icon className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">{card.title}</p>
              <h2 className="text-2xl font-bold">{card.value}</h2>
            </div>
          </Card>
        ))}
      </div>

      {/* First Row of Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card onClick={() => router.push("/stats")} className={chartCardClass}>
          <CardHeader>
            <CardTitle>Daily Recognitions</CardTitle>
          </CardHeader>
          <CardContent>{loading ? placeholder(200) : <Line data={lineData} />}</CardContent>
        </Card>

        <Card onClick={() => router.push("/stats")} className={chartCardClass}>
          <CardHeader>
            <CardTitle>Top Recognized Inmates</CardTitle>
          </CardHeader>
          <CardContent>{loading ? placeholder(200) : <Bar data={topInmatesData} />}</CardContent>
        </Card>

        <Card onClick={() => router.push("/stats")} className={chartCardClass}>
          <CardHeader>
            <CardTitle>Recognitions by Officer</CardTitle>
          </CardHeader>
          <CardContent>{loading ? placeholder(200) : <Pie data={officerData} />}</CardContent>
        </Card>
      </div>

      {/* Second Row of Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card onClick={() => router.push("/stats")} className={chartCardClass}>
          <CardHeader>
            <CardTitle>Age Distribution</CardTitle>
          </CardHeader>
          <CardContent>{loading ? placeholder(200) : <Pie data={ageData} />}</CardContent>
        </Card>

        <Card onClick={() => router.push("/stats")} className={chartCardClass}>
          <CardHeader>
            <CardTitle>Sex Distribution</CardTitle>
          </CardHeader>
          <CardContent>{loading ? placeholder(200) : <Pie data={sexData} />}</CardContent>
        </Card>

        <Card onClick={() => router.push("/stats")} className={chartCardClass}>
          <CardHeader>
            <CardTitle>Legal Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>{loading ? placeholder(200) : <Pie data={legalData} />}</CardContent>
        </Card>
      </div>

      {/* Facility (wide) */}
      <div className="grid grid-cols-1 gap-6">
        <Card onClick={() => router.push("/stats")} className={chartCardClass}>
          <CardHeader>
            <CardTitle>Facility Distribution</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 320 }}>
            {loading ? placeholder(320) : <Bar data={facilityBarData} options={facilityBarOptions} />}
          </CardContent>
        </Card>
      </div>

      {/* Recent Verifications & Live Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RecentVerifications />
        <LiveActivityFeed />
      </div>
    </div>
  );
}
