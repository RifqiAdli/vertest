import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Eye, Zap, Users, Trophy, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { testTypeLabels } from "@/utils/formatters";

interface TestItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  difficulty: string;
  duration_minutes: number;
  total_questions: number;
}

const typeIcons: Record<string, typeof Brain> = {
  iq: Brain,
  concentration: Eye,
  mixed: Zap,
};

const diffColors: Record<string, string> = {
  easy: "bg-success/10 text-success",
  medium: "bg-warning/10 text-warning",
  hard: "bg-destructive/10 text-destructive",
};

export default function LandingPage() {
  const [tests, setTests] = useState<TestItem[]>([]);
  const [stats, setStats] = useState({ today: 0, total: 0, avgScore: 0 });

  useEffect(() => {
    const fetchTests = async () => {
      const { data } = await supabase
        .from("tests")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (data) setTests(data);
    };

    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { count: todayCount } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .gte("started_at", today);
      const { count: totalCount } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true });
      const { data: avgData } = await supabase
        .from("results")
        .select("score_percentage");
      const avg = avgData?.length
        ? Math.round(avgData.reduce((s, r) => s + (r.score_percentage || 0), 0) / avgData.length)
        : 0;
      setStats({ today: todayCount || 0, total: totalCount || 0, avgScore: avg });
    };

    fetchTests();
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            <span className="text-xl font-display font-bold text-primary">VreTest</span>
          </Link>
          <Link to="/admin/login">
            <Button variant="ghost" size="sm">Admin</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="container py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-6xl font-display font-extrabold text-foreground mb-4">
            Ukur Potensimu,{" "}
            <span className="text-primary">Kenali Dirimu</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Platform uji konsentrasi &amp; IQ berbasis AI. Dapatkan analisis mendalam dan rekomendasi pengembangan diri.
          </p>
          <a href="#tests">
            <Button size="lg" className="text-lg px-8 py-6 rounded-full shadow-lg">
              Mulai Tes Sekarang
            </Button>
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-16"
        >
          {[
            { icon: Users, label: "Peserta Hari Ini", value: stats.today },
            { icon: Trophy, label: "Total Peserta", value: stats.total },
            { icon: BarChart3, label: "Rata-rata Skor", value: `${stats.avgScore}%` },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <s.icon className="h-6 w-6 text-primary mx-auto mb-2" />
              <div className="text-2xl font-display font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Tests Grid */}
      <section id="tests" className="container pb-20">
        <h2 className="text-2xl font-display font-bold text-center mb-8">Pilih Jenis Tes</h2>
        {tests.length === 0 ? (
          <p className="text-center text-muted-foreground">Belum ada tes yang tersedia. Admin perlu membuat tes terlebih dahulu.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {tests.map((test, i) => {
              const Icon = typeIcons[test.type] || Brain;
              return (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link to={`/test/entry/${test.id}`}>
                    <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer border-2 hover:border-primary/30">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-display font-semibold text-lg mb-1">{test.title}</h3>
                            <p className="text-sm text-muted-foreground mb-3">{test.description}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">
                                {testTypeLabels[test.type] || test.type}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${diffColors[test.difficulty] || ""}`}>
                                {test.difficulty === "easy" ? "Mudah" : test.difficulty === "medium" ? "Sedang" : "Sulit"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {test.duration_minutes} menit • {test.total_questions} soal
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} VreTest — Ukur Potensimu, Kenali Dirimu
        </div>
      </footer>
    </div>
  );
}
