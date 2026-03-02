import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/layout/AdminLayout";
import { questionTypeLabels, truncate } from "@/utils/formatters";
import { useToast } from "@/hooks/use-toast";

export default function AdminQuestions() {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [filterTestId, setFilterTestId] = useState<string>("all");
  const [editDialog, setEditDialog] = useState(false);
  const [editQ, setEditQ] = useState<any>(null);

  const fetchQuestions = async () => {
    let query = supabase.from("questions").select("*, tests(title)").order("test_id").order("question_number");
    if (filterTestId !== "all") query = query.eq("test_id", filterTestId);
    const { data } = await query;
    if (data) setQuestions(data);
  };

  const fetchTests = async () => {
    const { data } = await supabase.from("tests").select("id, title").order("title");
    if (data) setTests(data);
  };

  useEffect(() => { fetchTests(); }, []);
  useEffect(() => { fetchQuestions(); }, [filterTestId]);

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus soal ini?")) return;
    await supabase.from("questions").delete().eq("id", id);
    toast({ title: "Soal dihapus" });
    fetchQuestions();
  };

  const handleSave = async () => {
    if (!editQ) return;
    const { id, content, type, correct_answer, explanation, points, options } = editQ;

    if (id) {
      await supabase.from("questions").update({ content, type, correct_answer, explanation, points, options }).eq("id", id);
      toast({ title: "Soal diperbarui" });
    } else {
      await supabase.from("questions").insert({
        test_id: editQ.test_id,
        question_number: editQ.question_number || 1,
        content, type, correct_answer, explanation, points: points || 10, options,
      });
      toast({ title: "Soal ditambahkan" });
    }
    setEditDialog(false);
    setEditQ(null);
    fetchQuestions();
  };

  const openEdit = (q: any) => {
    setEditQ({ ...q });
    setEditDialog(true);
  };

  const openNew = () => {
    setEditQ({
      id: null,
      test_id: filterTestId !== "all" ? filterTestId : tests[0]?.id || "",
      question_number: questions.length + 1,
      content: "",
      type: "logic",
      options: [
        { label: "A", value: "" },
        { label: "B", value: "" },
        { label: "C", value: "" },
        { label: "D", value: "" },
      ],
      correct_answer: "",
      explanation: "",
      points: 10,
    });
    setEditDialog(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">Kelola Soal</h1>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Tambah Soal</Button>
        </div>

        <div className="flex gap-3">
          <Select value={filterTestId} onValueChange={setFilterTestId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Filter tes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tes</SelectItem>
              {tests.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Tes</TableHead>
                  <TableHead>Soal</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Jawaban</TableHead>
                  <TableHead>Poin</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>{q.question_number}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{q.tests?.title}</TableCell>
                    <TableCell className="max-w-xs">{truncate(q.content, 60)}</TableCell>
                    <TableCell><Badge variant="secondary">{questionTypeLabels[q.type] || q.type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{q.correct_answer}</TableCell>
                    <TableCell>{q.points}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(q)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {questions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada soal</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editQ?.id ? "Edit Soal" : "Tambah Soal"}</DialogTitle>
            </DialogHeader>
            {editQ && (
              <div className="space-y-4">
                {!editQ.id && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Tes</label>
                    <Select value={editQ.test_id} onValueChange={(v) => setEditQ({ ...editQ, test_id: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {tests.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium mb-1 block">Konten Soal</label>
                  <Textarea rows={3} value={editQ.content} onChange={(e) => setEditQ({ ...editQ, content: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Tipe</label>
                  <Select value={editQ.type} onValueChange={(v) => setEditQ({ ...editQ, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(questionTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Opsi Jawaban</label>
                  <div className="space-y-2">
                    {(editQ.options || []).map((opt: any, i: number) => (
                      <div key={i} className="flex gap-2 items-center">
                        <span className="font-mono text-sm w-6">{opt.label}</span>
                        <Input
                          value={opt.value}
                          onChange={(e) => {
                            const newOpts = [...editQ.options];
                            newOpts[i] = { ...newOpts[i], value: e.target.value };
                            setEditQ({ ...editQ, options: newOpts });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Jawaban Benar</label>
                  <Input value={editQ.correct_answer} onChange={(e) => setEditQ({ ...editQ, correct_answer: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Penjelasan</label>
                  <Textarea rows={2} value={editQ.explanation || ""} onChange={(e) => setEditQ({ ...editQ, explanation: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Poin</label>
                  <Input type="number" value={editQ.points} onChange={(e) => setEditQ({ ...editQ, points: parseInt(e.target.value) || 10 })} />
                </div>
                <Button onClick={handleSave} className="w-full">Simpan</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
