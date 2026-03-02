import { useEffect, useState } from "react";
import { Download, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/layout/AdminLayout";
import { formatDate, testTypeLabels } from "@/utils/formatters";
import { useToast } from "@/hooks/use-toast";

export default function AdminResults() {
  const { toast } = useToast();
  const [results, setResults] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [filterTestId, setFilterTestId] = useState("all");
  const [detail, setDetail] = useState<any>(null);
  const [detailAnswers, setDetailAnswers] = useState<any[]>([]);

  const fetchResults = async () => {
    let query = supabase.from("results").select("*, tests(title, type)").order("generated_at", { ascending: false });
    if (filterTestId !== "all") query = query.eq("test_id", filterTestId);
    const { data } = await query;
    if (data) setResults(data);
  };

  useEffect(() => {
    supabase.from("tests").select("id, title").order("title").then(({ data }) => { if (data) setTests(data); });
  }, []);
  useEffect(() => { fetchResults(); }, [filterTestId]);

  const viewDetail = async (result: any) => {
    setDetail(result);
    const { data } = await supabase
      .from("answers")
      .select("*, questions(content, correct_answer, type)")
      .eq("session_id", result.session_id);
    setDetailAnswers(data || []);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus hasil ini?")) return;
    await supabase.from("results").delete().eq("id", id);
    toast({ title: "Hasil dihapus" });
    fetchResults();
  };

  const exportCSV = () => {
    const headers = ["Nama", "Tes", "Skor", "Persentase", "IQ", "Konsentrasi", "Badge", "Tanggal"];
    const rows = results.map((r) => [
      r.participant_name, r.tests?.title, r.score_raw, r.score_percentage, r.iq_estimate, r.concentration_level, r.badge, r.generated_at
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vretest-results.csv";
    a.click();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">Hasil Tes</h1>
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
        </div>

        <Select value={filterTestId} onValueChange={setFilterTestId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Filter tes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tes</SelectItem>
            {tests.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
          </SelectContent>
        </Select>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peserta</TableHead>
                  <TableHead>Tes</TableHead>
                  <TableHead>Skor</TableHead>
                  <TableHead>IQ</TableHead>
                  <TableHead>Badge</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.participant_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.tests?.title}</TableCell>
                    <TableCell>
                      <Badge variant={r.score_percentage >= 70 ? "default" : "secondary"}>
                        {r.score_percentage}%
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{r.iq_estimate || "-"}</TableCell>
                    <TableCell className="text-sm">{r.badge}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.generated_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => viewDetail(r)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada hasil</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detail Hasil - {detail?.participant_name}</DialogTitle>
            </DialogHeader>
            {detail && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Card><CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-primary">{detail.score_percentage}%</div>
                    <div className="text-xs text-muted-foreground">Skor</div>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <div className="text-xl font-bold">{detail.iq_estimate || "-"}</div>
                    <div className="text-xs text-muted-foreground">IQ</div>
                  </CardContent></Card>
                  <Card><CardContent className="p-3 text-center">
                    <div className="text-sm font-bold">{detail.badge}</div>
                    <div className="text-xs text-muted-foreground">Badge</div>
                  </CardContent></Card>
                </div>

                {detail.ai_analysis && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Analisis AI</h3>
                    <p className="text-sm text-muted-foreground">{detail.ai_analysis}</p>
                  </div>
                )}

                {detail.strengths && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Kekuatan</h3>
                    <ul className="text-sm text-muted-foreground list-disc list-inside">
                      {(detail.strengths as string[]).map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}

                {detailAnswers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Jawaban ({detailAnswers.filter(a => a.is_correct).length}/{detailAnswers.length} benar)</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {detailAnswers.map((a, i) => (
                        <div key={i} className={`p-2 rounded text-xs ${a.is_correct ? "bg-success/10" : "bg-destructive/10"}`}>
                          <div className="font-medium">{a.questions?.content}</div>
                          <div className="mt-1 text-muted-foreground">
                            Jawaban: {a.given_answer} {!a.is_correct && `• Benar: ${a.questions?.correct_answer}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
