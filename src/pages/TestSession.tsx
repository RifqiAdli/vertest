import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronLeft, ChevronRight, Send, Loader2, AlertCircle, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useTimer } from "@/hooks/useTimer";
import { useToast } from "@/hooks/use-toast";
import { formatDuration, questionTypeLabels } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface Question {
  id: string;
  test_id: string;
  question_number: number;
  content: string;
  type: string;
  options: Array<{ label: string; value: string }> | null;
  correct_answer: string;
  points: number | null;
}

interface SessionData {
  id: string;
  test_id: string;
  participant_name: string;
  status: string | null;
}

export default function TestSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // 1. Definisikan semua State di awal
  const [session, setSession] = useState<SessionData | null>(null);
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const questionStartTime = useRef(Date.now());

  // 2. Setup Timer & Submit Logic
  const handleSubmit = useCallback(async () => {
    if (submitting || !sessionId) return;
    setSubmitting(true);
    try {
      const elapsed = test ? test.duration_minutes * 60 - remaining : 0;
      await supabase
        .from("sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          time_spent_seconds: Math.max(0, elapsed),
        })
        .eq("id", sessionId);

      navigate(`/test/result/${sessionId}`);
    } catch (e: any) {
      toast({ title: "Gagal menyelesaikan tes", description: e.message, variant: "destructive" });
      setSubmitting(false);
    }
  }, [submitting, sessionId, test, navigate, toast]);

  const handleTimeUp = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  const { remaining, progress, start } = useTimer(
    test?.duration_minutes ? test.duration_minutes * 60 : 1800,
    handleTimeUp
  );

  // 3. Load Data Effect
  useEffect(() => {
    if (!sessionId) {
      navigate("/");
      return;
    }

    const load = async () => {
      try {
        const { data: sess, error: sessErr } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessErr || !sess || !sess.test_id) {
          setErrorMsg("Sesi atau data tes tidak valid.");
          setLoading(false);
          return;
        }

        setSession(sess as SessionData);

        const { data: t, error: testErr } = await supabase
          .from("tests")
          .select("*")
          .eq("id", sess.test_id)
          .single();

        if (testErr || !t) {
          setErrorMsg("Data tes tidak ditemukan.");
          setLoading(false);
          return;
        }
        setTest(t);

        // Load existing answers
        const { data: ansData } = await supabase
          .from("answers")
          .select("question_id, given_answer")
          .eq("session_id", sessionId);
        
        if (ansData) {
          const ansMap: Record<string, string> = {};
          ansData.forEach(a => { if(a.given_answer) ansMap[a.question_id] = a.given_answer });
          setAnswers(ansMap);
        }

        const { data: qs } = await supabase
          .from("questions")
          .select("*")
          .eq("test_id", sess.test_id)
          .order("question_number");

        if (qs && qs.length > 0) {
          setQuestions(qs as Question[]);
          setLoading(false);
          start();
        } else {
          setLoading(false);
          setGenerating(true);
          const { data: fnData, error: fnError } = await supabase.functions.invoke(
            "generate-questions",
            { body: { test_id: sess.test_id, test_type: t.type, difficulty: t.difficulty, count: t.total_questions || 10 } }
          );

          if (fnError || !fnData?.success) throw new Error(fnData?.error || "AI gagal membuat soal");

          const { data: saved } = await supabase
            .from("questions")
            .select("*")
            .eq("test_id", sess.test_id)
            .order("question_number");

          if (saved) setQuestions(saved as Question[]);
          start();
          setGenerating(false);
        }
      } catch (e: any) {
        setErrorMsg(e.message);
        setLoading(false);
        setGenerating(false);
      }
    };

    load();
  }, [sessionId, navigate, start]);

  // 4. Action Handlers
  const selectAnswer = async (value: string) => {
    const currentQ = questions[currentIdx];
    if (!currentQ || !sessionId) return;
    
    const responseTime = Date.now() - questionStartTime.current;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: value }));

    const isCorrect = value === currentQ.correct_answer;

    const { data: existing } = await supabase
      .from("answers")
      .select("id")
      .eq("session_id", sessionId)
      .eq("question_id", currentQ.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("answers").update({ given_answer: value, is_correct: isCorrect, response_time_ms: responseTime }).eq("id", existing.id);
    } else {
      await supabase.from("answers").insert({ session_id: sessionId, question_id: currentQ.id, given_answer: value, is_correct: isCorrect, response_time_ms: responseTime });
    }
  };

  const goNext = () => { if (currentIdx < questions.length - 1) { setCurrentIdx(prev => prev + 1); questionStartTime.current = Date.now(); } };
  const goPrev = () => { if (currentIdx > 0) { setCurrentIdx(prev => prev - 1); questionStartTime.current = Date.now(); } };

  // 5. Variabel Bantu untuk Render
  const currentQ = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const timerColor = remaining > 60 ? "text-primary" : remaining > 30 ? "text-amber-500" : "text-destructive animate-pulse";

  // 6. Conditional Rendering
  if (loading || generating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="p-8 bg-white rounded-2xl shadow-xl flex flex-col items-center gap-4 text-center border border-slate-100">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <h3 className="text-xl font-bold text-slate-800">{generating ? "AI sedang membuat soal..." : "Memuat Sesi..."}</h3>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground text-center max-w-sm font-medium">{errorMsg}</p>
        <Button onClick={() => navigate("/")} variant="outline">Kembali ke Beranda</Button>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2 rounded-lg">
              <span className="text-primary font-black text-xl tracking-tighter italic">CBT</span>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="hidden sm:block">
              <h1 className="font-bold text-slate-800 truncate max-w-[200px]">{test?.title}</h1>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                <User className="h-3 w-3" /> {session?.participant_name}
              </div>
            </div>
          </div>

          <div className={cn(
            "flex items-center gap-3 px-5 py-2 rounded-full bg-white border-2 transition-all shadow-sm",
            remaining < 60 ? "border-red-500 bg-red-50" : "border-slate-100"
          )}>
            <Clock className={cn("h-5 w-5", timerColor)} />
            <span className={cn("font-mono text-xl font-black", timerColor)}>
              {formatDuration(remaining)}
            </span>
          </div>
        </div>
        <Progress value={progress} className="h-1 rounded-none bg-slate-100" />
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        <div className="lg:col-span-8 flex flex-col gap-6 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
               <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Pertanyaan {currentIdx + 1}</h2>
               <div className="h-1 w-8 bg-primary rounded-full mt-1" />
            </div>
            <div className="flex gap-2">
               <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1.5 rounded-md border border-blue-100 uppercase italic">
                 {questionTypeLabels[currentQ.type] || currentQ.type}
               </span>
               <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1.5 rounded-md border border-slate-200">
                 {currentQ.points || 10} POIN
               </span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <Card className="border-none shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/60 rounded-2xl overflow-hidden">
                <CardContent className="p-8 md:p-12 bg-white">
                  <p className="text-xl md:text-2xl text-slate-800 leading-relaxed font-bold tracking-tight whitespace-pre-wrap">
                    {currentQ.content}
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-4">
                {(currentQ.options || []).map((opt) => {
                  const selected = answers[currentQ.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => selectAnswer(opt.value)}
                      className={cn(
                        "group w-full text-left p-5 rounded-2xl border-2 transition-all duration-300 flex items-center gap-5",
                        selected
                          ? "border-primary bg-primary/5 shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                      )}
                    >
                      <div className={cn(
                        "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg transition-all shadow-sm",
                        selected ? "bg-primary text-white rotate-3" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                      )}>
                        {opt.label}
                      </div>
                      <span className={cn(
                        "text-lg transition-colors",
                        selected ? "text-primary font-bold" : "text-slate-700 font-medium"
                      )}>
                        {opt.value}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-8 py-6 border-t border-slate-200">
            <Button variant="ghost" size="lg" onClick={goPrev} disabled={currentIdx === 0} className="font-bold text-slate-500 hover:bg-slate-100 rounded-xl">
              <ChevronLeft className="h-5 w-5 mr-2" /> SEBELUMNYA
            </Button>

            {currentIdx === questions.length - 1 ? (
              <Button onClick={handleSubmit} disabled={submitting} size="lg" className="bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-200/50 px-10 rounded-2xl font-black italic">
                {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5 mr-2" />} SELESAIKAN UJIAN
              </Button>
            ) : (
              <Button onClick={goNext} size="lg" className="px-10 rounded-2xl font-black shadow-xl shadow-primary/20 italic">
                BERIKUTNYA <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/60 bg-white rounded-2xl overflow-hidden">
            <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Menu className="h-4 w-4 text-slate-400" />
                <h3 className="font-black text-slate-700 text-xs tracking-widest uppercase">Navigasi Soal</h3>
              </div>
              <span className="text-[10px] font-black bg-white px-2 py-1 rounded border border-slate-200 text-slate-500 italic">
                {answeredCount}/{questions.length} SELESAI
              </span>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-5 gap-3">
                {questions.map((q, i) => {
                  const isCurrent = i === currentIdx;
                  const isAnswered = !!answers[q.id];
                  return (
                    <button
                      key={q.id}
                      onClick={() => { setCurrentIdx(i); questionStartTime.current = Date.now(); }}
                      className={cn(
                        "h-12 rounded-xl text-sm font-black transition-all relative",
                        isCurrent 
                          ? "bg-slate-800 text-white shadow-lg shadow-slate-400 z-10 scale-110 -rotate-2" 
                          : isAnswered 
                            ? "bg-emerald-50 text-emerald-600 border-2 border-emerald-100 hover:bg-emerald-100" 
                            : "bg-slate-50 text-slate-300 border-2 border-transparent hover:border-slate-200 hover:bg-white"
                      )}
                    >
                      {i + 1}
                      {isAnswered && !isCurrent && <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/20 transition-all" />
            <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2 text-primary">
              <AlertCircle className="h-4 w-4" /> Informasi
            </h4>
            <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
              Sistem akan otomatis mengakhiri ujian jika waktu habis. Pastikan semua nomor berwarna <span className="text-emerald-400 font-bold italic underline">hijau</span> sebelum menekan tombol selesai.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}