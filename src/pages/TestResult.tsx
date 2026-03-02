import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Trophy, ArrowLeft, RefreshCw, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { calculateScorePercentage, estimateIQ, getConcentrationLevel, getCategoryAccuracy } from "@/utils/scoring";
import { testTypeLabels, questionTypeLabels } from "@/utils/formatters";
import { cn } from "@/lib/utils";

interface ResultData {
  score_raw: number;
  score_percentage: number | null;
  iq_estimate: number | null;
  concentration_level: string | null;
  percentile: number | null;
  badge: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  recommendations: string[] | null;
  ai_analysis: string | null;
}

interface AnswerDetail {
  question_content: string;
  question_type: string;
  given_answer: string | null;
  correct_answer: string;
  is_correct: boolean | null;
  response_time_ms: number | null;
}

export default function TestResult() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<ResultData | null>(null);
  const [answerDetails, setAnswerDetails] = useState<AnswerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [test, setTest] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) return;

    const load = async () => {
      // Check if result already exists
      const { data: existingResult } = await supabase
        .from("results")
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (existingResult) {
        setResult({
          ...existingResult,
          strengths: existingResult.strengths as string[] | null,
          weaknesses: existingResult.weaknesses as string[] | null,
          recommendations: existingResult.recommendations as string[] | null,
        });
        setLoading(false);
        loadAnswerDetails();
        return;
      }

      // Load session
      const { data: sess } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
      if (!sess) { navigate("/"); return; }
      setSession(sess);

      const { data: t } = await supabase.from("tests").select("*").eq("id", sess.test_id!).single();
      setTest(t);

      // Load answers with questions
      const { data: answersData } = await supabase
        .from("answers")
        .select("*, questions(*)")
        .eq("session_id", sessionId);

      if (!answersData || answersData.length === 0) {
        setLoading(false);
        return;
      }

      const details: AnswerDetail[] = answersData.map((a: any) => ({
        question_content: a.questions?.content || "",
        question_type: a.questions?.type || "",
        given_answer: a.given_answer,
        correct_answer: a.questions?.correct_answer || "",
        is_correct: a.is_correct,
        response_time_ms: a.response_time_ms,
      }));
      setAnswerDetails(details);

      const correctCount = answersData.filter((a: any) => a.is_correct).length;
      const totalQuestions = answersData.length;
      const percentage = calculateScorePercentage(correctCount, totalQuestions);
      const iqEst = estimateIQ(percentage);
      const concLevel = getConcentrationLevel(percentage);

      // AI Analysis
      setAnalyzing(true);
      setLoading(false);

      const categoryAcc = getCategoryAccuracy(
        answersData.map((a: any) => ({
          is_correct: a.is_correct,
          question_type: a.questions?.type || "unknown",
        }))
      );

      const avgResponseTime = answersData.reduce((sum: number, a: any) => sum + (a.response_time_ms || 0), 0) / answersData.length / 1000;

      try {
        const { data: aiData, error: aiError } = await supabase.functions.invoke("analyze-results", {
          body: {
            sessionData: {
              name: sess.participant_name,
              testType: testTypeLabels[t?.type || ""] || t?.type,
              score: correctCount * 10,
              totalScore: totalQuestions * 10,
              percentage,
              timeSpent: Math.round((sess.time_spent_seconds || 0) / 60),
              duration: t?.duration_minutes || 30,
              correctAnswers: correctCount,
              totalQuestions,
              categoryAccuracy: categoryAcc,
              avgResponseTime: Math.round(avgResponseTime * 10) / 10,
            },
          },
        });

        if (aiError) throw aiError;
        const analysis = aiData.analysis;

        const resultData: ResultData = {
          score_raw: correctCount * 10,
          score_percentage: percentage,
          iq_estimate: analysis.iq_estimate || iqEst,
          concentration_level: analysis.concentration_level || concLevel,
          percentile: analysis.percentile || Math.round(percentage * 0.95),
          badge: analysis.badge || "Pejuang Cerdas",
          strengths: analysis.strengths || [],
          weaknesses: analysis.weaknesses || [],
          recommendations: analysis.recommendations || [],
          ai_analysis: analysis.ai_analysis || "",
        };

        // Save to DB
        await supabase.from("results").insert({
          session_id: sessionId,
          test_id: sess.test_id,
          participant_name: sess.participant_name,
          ...resultData,
        });

        setResult(resultData);
      } catch (e) {
        // Fallback without AI
        const resultData: ResultData = {
          score_raw: correctCount * 10,
          score_percentage: percentage,
          iq_estimate: iqEst,
          concentration_level: concLevel,
          percentile: Math.round(percentage * 0.95),
          badge: percentage >= 80 ? "Jenius Muda" : percentage >= 60 ? "Pemikir Andal" : "Pejuang Cerdas",
          strengths: ["Mampu menyelesaikan tes"],
          weaknesses: ["Perlu latihan lebih"],
          recommendations: ["Latihan soal lebih sering", "Istirahat cukup sebelum tes"],
          ai_analysis: `Dengan skor ${percentage}%, kamu menunjukkan kemampuan yang ${percentage >= 70 ? "baik" : "perlu ditingkatkan"}.`,
        };

        await supabase.from("results").insert({
          session_id: sessionId,
          test_id: sess.test_id,
          participant_name: sess.participant_name,
          ...resultData,
        });

        setResult(resultData);
      }
      setAnalyzing(false);
    };

    const loadAnswerDetails = async () => {
      const { data: answersData } = await supabase
        .from("answers")
        .select("*, questions(*)")
        .eq("session_id", sessionId);

      if (answersData) {
        setAnswerDetails(answersData.map((a: any) => ({
          question_content: a.questions?.content || "",
          question_type: a.questions?.type || "",
          given_answer: a.given_answer,
          correct_answer: a.questions?.correct_answer || "",
          is_correct: a.is_correct,
          response_time_ms: a.response_time_ms,
        })));
      }
    };

    load();
  }, [sessionId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Memuat hasil...</div>
    </div>
  );

  if (analyzing) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-12 w-12 text-primary animate-spin" />
      <p className="text-xl font-display font-bold">AI sedang menganalisis hasil...</p>
      <p className="text-muted-foreground">Mohon tunggu beberapa saat</p>
    </div>
  );

  if (!result) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Tidak ada hasil ditemukan.</p>
    </div>
  );

  const scorePercent = result.score_percentage || 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (scorePercent / 100) * circumference;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="container flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="font-display font-bold">Hasil Tes</h1>
            <p className="text-sm text-muted-foreground">Analisis lengkap performa kamu</p>
          </div>
        </div>
      </header>

      <div className="container max-w-3xl py-8 space-y-6">
        {/* Score Circle & Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="relative w-36 h-36 mx-auto mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="animate-score-fill"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-display font-bold">{Math.round(scorePercent)}%</span>
              <span className="text-xs text-muted-foreground">Skor</span>
            </div>
          </div>

          {result.badge && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Badge className="text-base px-4 py-1 bg-primary/10 text-primary border-primary/20">
                <Trophy className="h-4 w-4 mr-1" /> {result.badge}
              </Badge>
            </motion.div>
          )}
        </motion.div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          {result.iq_estimate && (
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-display font-bold text-primary">{result.iq_estimate}</div>
                <div className="text-xs text-muted-foreground">Estimasi IQ</div>
              </CardContent>
            </Card>
          )}
          {result.concentration_level && (
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm font-display font-bold text-primary">{result.concentration_level}</div>
                <div className="text-xs text-muted-foreground">Level Konsentrasi</div>
              </CardContent>
            </Card>
          )}
          {result.percentile && (
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-display font-bold text-primary">{result.percentile}%</div>
                <div className="text-xs text-muted-foreground">Persentil</div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* AI Analysis */}
        {result.ai_analysis && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Analisis AI</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground leading-relaxed">{result.ai_analysis}</p></CardContent>
          </Card>
        )}

        {/* Strengths & Weaknesses */}
        <div className="grid md:grid-cols-2 gap-4">
          {result.strengths && result.strengths.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base text-success">💪 Kekuatan</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(result.strengths as string[]).map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {result.weaknesses && result.weaknesses.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base text-warning">⚡ Area Pengembangan</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(result.weaknesses as string[]).map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-warning mt-0.5 shrink-0">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recommendations */}
        {result.recommendations && (result.recommendations as string[]).length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">📋 Rekomendasi</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2 list-decimal list-inside">
                {(result.recommendations as string[]).map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground">{r}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Answer Review */}
        {answerDetails.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">📝 Review Jawaban</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {answerDetails.map((a, i) => (
                  <div key={i} className={cn(
                    "p-3 rounded-lg border text-sm",
                    a.is_correct ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium flex-1">{i + 1}. {a.question_content}</p>
                      {a.is_correct ? (
                        <Check className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-destructive shrink-0" />
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Jawaban: <span className={a.is_correct ? "text-success" : "text-destructive"}>{a.given_answer || "-"}</span>
                      {!a.is_correct && <> • Benar: <span className="text-success">{a.correct_answer}</span></>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Link to="/">
            <Button variant="outline" className="rounded-full">
              <RefreshCw className="h-4 w-4 mr-1" /> Coba Lagi
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
