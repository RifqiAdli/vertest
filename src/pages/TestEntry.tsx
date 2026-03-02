import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Brain, Clock, HelpCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { testTypeLabels, difficultyLabels } from "@/utils/formatters";
import { useToast } from "@/hooks/use-toast";

export default function TestEntry() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [test, setTest] = useState<any>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!testId) return;
    supabase.from("tests").select("*").eq("id", testId).single().then(({ data }) => {
      if (data) setTest(data);
    });
  }, [testId]);

  const handleStart = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) {
      toast({ title: "Nama harus 2-50 karakter", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const deviceInfo = {
        browser: navigator.userAgent,
        screen: `${screen.width}x${screen.height}`,
        platform: navigator.platform,
      };

      const { data: session, error } = await supabase
        .from("sessions")
        .insert({
          test_id: testId!,
          participant_name: trimmed,
          device_info: deviceInfo,
        })
        .select()
        .single();

      if (error) throw error;
      navigate(`/test/session/${session.id}`);
    } catch (e: any) {
      toast({ title: "Gagal memulai tes", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!test) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Memuat...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <button onClick={() => navigate("/")} className="absolute top-4 left-4 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="mx-auto p-3 rounded-xl bg-primary/10 text-primary w-fit mb-3">
            <Brain className="h-8 w-8" />
          </div>
          <CardTitle className="font-display text-xl">{test.title}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{test.description}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> {test.duration_minutes} menit
            </span>
            <span className="flex items-center gap-1">
              <HelpCircle className="h-4 w-4" /> {test.total_questions} soal
            </span>
          </div>

          <div className="flex justify-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">
              {testTypeLabels[test.type] || test.type}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">
              {difficultyLabels[test.difficulty] || test.difficulty}
            </span>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Nama Peserta</label>
            <Input
              placeholder="Masukkan nama lengkap"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
            />
            <p className="text-xs text-muted-foreground mt-1">Min. 2 karakter, maks. 50 karakter</p>
          </div>

          <Button
            onClick={handleStart}
            disabled={loading || name.trim().length < 2}
            className="w-full rounded-full"
            size="lg"
          >
            {loading ? "Memulai..." : "Mulai Tes"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Tes ini bersifat estimasi dan tidak menggantikan evaluasi profesional.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
