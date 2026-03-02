import { useEffect, useState } from "react";
import { Users, Trophy, BarChart3, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import AdminLayout from "@/components/layout/AdminLayout";
import { formatRelative } from "@/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(224, 76%, 40%)", "hsl(160, 60%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)"];

export default function AdminDashboard() {
  const [stats, setStats] = useState({ today: 0, avgScore: 0, activeSessions: 0, total: 0 });
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [scoreDistribution, setScoreDistribution] = useState<any[]>([]);
  const [typeDistribution, setTypeDistribution] = useState<any[]>([]);

  useRealtime("sessions");
  useRealtime("results");

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];

    const [todayRes, totalRes, activeRes, avgRes, recentRes] = await Promise.all([
      supabase.from("sessions").select("*", { count: "exact", head: true }).gte("started_at", today),
      supabase.from("sessions").select("*", { count: "exact", head: true }),
      supabase.from("sessions").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
      supabase.from("results").select("score_percentage"),
      supabase.from("sessions").select("*, tests(title, type)").order("started_at", { ascending: false }).limit(10),
    ]);

    const avg = avgRes.data?.length
      ? Math.round(avgRes.data.reduce((s, r) => s + (r.score_percentage || 0), 0) / avgRes.data.length)
      : 0;

    setStats({
      today: todayRes.count || 0,
      total: totalRes.count || 0,
      activeSessions: activeRes.count || 0,
      avgScore: avg,
    });
    setRecentSessions(recentRes.data || []);

    // Daily data (last 7 days)
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .gte("started_at", dateStr)
        .lt("started_at", new Date(d.getTime() + 86400000).toISOString().split("T")[0]);
      days.push({ date: dateStr.slice(5), peserta: count || 0 });
    }
    setDailyData(days);

    // Score distribution
    if (avgRes.data) {
      const dist = [
        { range: "0-25", count: 0 },
        { range: "26-50", count: 0 },
        { range: "51-75", count: 0 },
        { range: "76-100", count: 0 },
      ];
      avgRes.data.forEach((r) => {
        const p = r.score_percentage || 0;
        if (p <= 25) dist[0].count++;
        else if (p <= 50) dist[1].count++;
        else if (p <= 75) dist[2].count++;
        else dist[3].count++;
      });
      setScoreDistribution(dist);
    }

    // Type distribution
    const { data: typesData } = await supabase.from("sessions").select("tests(type)");
    if (typesData) {
      const counts: Record<string, number> = {};
      typesData.forEach((s: any) => {
        const t = s.tests?.type || "unknown";
        counts[t] = (counts[t] || 0) + 1;
      });
      setTypeDistribution(Object.entries(counts).map(([name, value]) => ({ name, value })));
    }
  };

  useEffect(() => { fetchData(); }, []);

  const statCards = [
    { icon: Users, label: "Peserta Hari Ini", value: stats.today, color: "text-primary" },
    { icon: BarChart3, label: "Rata-rata Skor", value: `${stats.avgScore}%`, color: "text-success" },
    { icon: Activity, label: "Sesi Aktif", value: stats.activeSessions, color: "text-warning", live: true },
    { icon: Trophy, label: "Total Peserta", value: stats.total, color: "text-primary" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                  {s.live && stats.activeSessions > 0 && (
                    <Badge variant="destructive" className="animate-pulse-live text-xs">LIVE</Badge>
                  )}
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-display font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Peserta 7 Hari Terakhir</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="peserta" stroke="hsl(224, 76%, 40%)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Distribusi Skor</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(224, 76%, 40%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Sessions */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Sesi Terbaru</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <span className="font-medium text-sm">{s.participant_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{s.tests?.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.status === "in_progress" ? (
                      <Badge variant="default" className="animate-pulse-live text-xs bg-success">Berlangsung</Badge>
                    ) : s.status === "completed" ? (
                      <Badge variant="secondary" className="text-xs">Selesai</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Ditinggalkan</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{formatRelative(s.started_at)}</span>
                  </div>
                </div>
              ))}
              {recentSessions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada sesi</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
