import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/layout/AdminLayout";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function AdminAnalytics() {
  const [scoresTrend, setScoresTrend] = useState<any[]>([]);
  const [iqDistribution, setIqDistribution] = useState<any[]>([]);
  const [topErrorQuestions, setTopErrorQuestions] = useState<any[]>([]);
  const [difficultyComparison, setDifficultyComparison] = useState<any[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      // Scores trend (last 14 days)
      const days: any[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const nextDate = new Date(d.getTime() + 86400000).toISOString().split("T")[0];
        const { data } = await supabase
          .from("results")
          .select("score_percentage")
          .gte("generated_at", dateStr)
          .lt("generated_at", nextDate);
        const avg = data?.length ? Math.round(data.reduce((s, r) => s + (r.score_percentage || 0), 0) / data.length) : null;
        days.push({ date: dateStr.slice(5), avg_score: avg });
      }
      setScoresTrend(days.filter(d => d.avg_score !== null));

      // IQ distribution
      const { data: iqData } = await supabase.from("results").select("iq_estimate").not("iq_estimate", "is", null);
      if (iqData) {
        const ranges = [
          { range: "70-85", min: 70, max: 85, count: 0 },
          { range: "86-100", min: 86, max: 100, count: 0 },
          { range: "101-115", min: 101, max: 115, count: 0 },
          { range: "116-130", min: 116, max: 130, count: 0 },
          { range: "131+", min: 131, max: 200, count: 0 },
        ];
        iqData.forEach(r => {
          const iq = r.iq_estimate || 0;
          const bucket = ranges.find(b => iq >= b.min && iq <= b.max);
          if (bucket) bucket.count++;
        });
        setIqDistribution(ranges);
      }

      // Top error questions
      const { data: answersData } = await supabase
        .from("answers")
        .select("question_id, is_correct, questions(content)")
        .eq("is_correct", false)
        .limit(500);

      if (answersData) {
        const errorCounts: Record<string, { content: string; count: number }> = {};
        answersData.forEach((a: any) => {
          const qid = a.question_id;
          if (!errorCounts[qid]) errorCounts[qid] = { content: a.questions?.content || "", count: 0 };
          errorCounts[qid].count++;
        });
        const sorted = Object.values(errorCounts).sort((a, b) => b.count - a.count).slice(0, 5);
        setTopErrorQuestions(sorted.map((q, i) => ({
          name: `Soal ${i + 1}`,
          errors: q.count,
          content: q.content.slice(0, 50) + "...",
        })));
      }

      // Difficulty comparison
      const { data: diffData } = await supabase
        .from("results")
        .select("score_percentage, tests(difficulty)");
      if (diffData) {
        const groups: Record<string, number[]> = {};
        diffData.forEach((r: any) => {
          const diff = r.tests?.difficulty || "unknown";
          if (!groups[diff]) groups[diff] = [];
          groups[diff].push(r.score_percentage || 0);
        });
        setDifficultyComparison(
          Object.entries(groups).map(([diff, scores]) => ({
            difficulty: diff === "easy" ? "Mudah" : diff === "medium" ? "Sedang" : diff === "hard" ? "Sulit" : diff,
            avg_score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
            count: scores.length,
          }))
        );
      }
    };

    fetchAnalytics();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold">Analitik</h1>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Tren Skor Rata-rata (14 hari)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={scoresTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg_score" stroke="hsl(224, 76%, 40%)" strokeWidth={2} name="Rata-rata Skor" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Distribusi Estimasi IQ</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={iqDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(224, 76%, 40%)" radius={[4, 4, 0, 0]} name="Jumlah" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Soal dengan Kesalahan Tertinggi</CardTitle></CardHeader>
            <CardContent>
              {topErrorQuestions.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topErrorQuestions} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="name" fontSize={11} width={60} />
                    <Tooltip content={({ payload }) => payload?.[0] ? (
                      <div className="bg-card p-2 rounded shadow border text-xs">
                        <p>{(payload[0].payload as any).content}</p>
                        <p className="font-bold mt-1">{payload[0].value} kesalahan</p>
                      </div>
                    ) : null} />
                    <Bar dataKey="errors" fill="hsl(0, 72%, 51%)" radius={[0, 4, 4, 0]} name="Kesalahan" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Performa per Tingkat Kesulitan</CardTitle></CardHeader>
            <CardContent>
              {difficultyComparison.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={difficultyComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="difficulty" fontSize={11} />
                    <YAxis fontSize={11} domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="avg_score" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} name="Skor Rata-rata" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Belum ada data</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
