import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sessionData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `Kamu adalah psikolog dan konsultan pengembangan diri profesional.
Analisis hasil tes berikut dengan mendalam dan berikan insight yang bermanfaat.

Data Peserta:
- Nama: ${sessionData.name}
- Jenis Tes: ${sessionData.testType}
- Skor: ${sessionData.score} dari ${sessionData.totalScore} (${sessionData.percentage}%)
- Waktu pengerjaan: ${sessionData.timeSpent} menit dari ${sessionData.duration} menit
- Total soal benar: ${sessionData.correctAnswers} dari ${sessionData.totalQuestions}
- Akurasi per kategori soal: ${JSON.stringify(sessionData.categoryAccuracy || {})}
- Waktu rata-rata per soal: ${sessionData.avgResponseTime || 0} detik

Berikan analisis dalam format JSON berikut:
{
  "iq_estimate": angka estimasi IQ (70-145),
  "concentration_level": "Sangat Tinggi|Tinggi|Sedang|Rendah|Sangat Rendah",
  "percentile": estimasi persentil (1-99),
  "badge": "nama gelar unik dan memotivasi berdasarkan hasil dalam Bahasa Indonesia",
  "strengths": ["kekuatan 1", "kekuatan 2", "kekuatan 3"],
  "weaknesses": ["kelemahan 1", "kelemahan 2"],
  "recommendations": ["rekomendasi praktis 1", "rekomendasi 2", "rekomendasi 3"],
  "ai_analysis": "Paragraf analisis mendalam 3-4 kalimat yang personal, jujur, dan memotivasi dalam Bahasa Indonesia"
}
Kembalikan HANYA JSON, tanpa penjelasan tambahan.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Kamu adalah psikolog profesional. Selalu kembalikan JSON yang valid." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits habis." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let analysis;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI analysis");
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-results error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
