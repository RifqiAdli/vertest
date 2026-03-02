import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ❌ JANGAN taruh Deno.env.get() di sini (module level)
// ✅ Semua env var harus dipanggil DI DALAM Deno.serve()

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ✅ Env var dipanggil di dalam handler
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  if (!GEMINI_API_KEY) {
    return jsonResponse({ error: "GEMINI_API_KEY belum dikonfigurasi di Secrets" }, 500);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized: token tidak ada" }, 401);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // Verifikasi user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized: token tidak valid" }, 401);
    }

    // Cek admin
    const { data: adminData } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminData) {
      return jsonResponse({ error: "Forbidden: bukan admin" }, 403);
    }

    // Parse body
    const { test_id, test_type, difficulty, count } = await req.json();
    if (!test_id || !test_type || !difficulty || !count) {
      return jsonResponse({ error: "Parameter tidak lengkap" }, 400);
    }

    // Build prompt
    const prompt = buildPrompt(test_type, difficulty, Number(count));

    // Panggil Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error ${geminiRes.status}: ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON soal
    let questions: any[];
    try {
      const cleaned = rawText.replace(/```json\n?|\n?```/g, "").trim();
      questions = JSON.parse(cleaned);
      if (!Array.isArray(questions)) throw new Error("Bukan array");
    } catch {
      console.error("Raw Gemini response:", rawText.slice(0, 500));
      throw new Error("Gagal parse soal dari AI. Coba generate ulang.");
    }

    // Ambil question_number terakhir
    const { data: existing } = await supabaseAdmin
      .from("questions")
      .select("question_number")
      .eq("test_id", test_id)
      .order("question_number", { ascending: false })
      .limit(1);

    const startNumber = existing?.[0]?.question_number
      ? existing[0].question_number + 1
      : 1;

    // Format untuk insert
    const toInsert = questions.map((q: any, i: number) => ({
      test_id,
      question_number: startNumber + i,
      content: String(q.content || ""),
      type: q.type || "multiple_choice",
      options: q.options || null,
      correct_answer: String(q.correct_answer || ""),
      explanation: q.explanation || null,
      points: Number(q.points) || 10,
      generated_by: "gemini-ai",
    }));

    // Insert ke Supabase
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("questions")
      .insert(toInsert)
      .select();

    if (insertError) throw new Error(`Insert error: ${insertError.message}`);

    // Update total_questions
    const { count: totalCount } = await supabaseAdmin
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("test_id", test_id);

    await supabaseAdmin
      .from("tests")
      .update({ total_questions: totalCount ?? toInsert.length })
      .eq("id", test_id);

    return jsonResponse({
      success: true,
      questions: inserted,
      count: inserted?.length ?? 0,
    });

  } catch (err: any) {
    console.error("generate-questions error:", err.message);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});

function buildPrompt(testType: string, difficulty: string, count: number): string {
  const diffDesc: Record<string, string> = {
    easy: "mudah (logika sederhana, cocok pemula)",
    medium: "menengah (butuh analisis lebih)",
    hard: "sulit (kemampuan analitis tinggi)",
  };

  const typeInstructions: Record<string, string> = {
    iq: `Buat ${count} soal IQ dalam Bahasa Indonesia. Campurkan tipe:
- Deret angka/huruf: temukan pola, lanjutkan deret
- Analogi kata: A:B = C:?
- Silogisme dan deduksi logis
- Matematika dasar cepat
- Klasifikasi: mana yang berbeda dari kelompok`,

    concentration: `Buat ${count} soal uji konsentrasi dalam Bahasa Indonesia. Campurkan tipe:
- Hitung kemunculan angka/huruf dalam teks panjang
- Temukan elemen berbeda dalam deret panjang
- Urutan memori: ingat dan urutkan kembali
- Fokus selektif: filter informasi relevan
- Temukan ketidakkonsistenan dalam paragraf`,

    mixed: `Buat ${count} soal campuran IQ dan konsentrasi (50/50) dalam Bahasa Indonesia. Campurkan:
- Deret angka/huruf
- Analogi kata
- Hitung kemunculan karakter
- Temukan pola berbeda
- Matematika dasar`,
  };

  return `${typeInstructions[testType] || typeInstructions.mixed}

Tingkat kesulitan: ${diffDesc[difficulty] || difficulty}

KEMBALIKAN HANYA JSON ARRAY MURNI, tanpa penjelasan, tanpa markdown, tanpa backtick.
Format setiap elemen:
[
  {
    "content": "teks soal lengkap dan jelas",
    "type": "sequence",
    "options": [
      {"label": "A", "value": "jawaban a"},
      {"label": "B", "value": "jawaban b"},
      {"label": "C", "value": "jawaban c"},
      {"label": "D", "value": "jawaban d"}
    ],
    "correct_answer": "value yang benar (HARUS IDENTIK dengan salah satu value di options)",
    "explanation": "penjelasan singkat mengapa ini benar",
    "points": 10
  }
]

ATURAN WAJIB:
1. correct_answer HARUS sama persis dengan salah satu value di options
2. Soal orisinal, tidak ambigu, satu jawaban jelas benar
3. Kembalikan HANYA JSON array, tidak ada teks apapun di luar array`;
}