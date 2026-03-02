import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/layout/AdminLayout";
import { testTypeLabels, difficultyLabels } from "@/utils/formatters";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface TestForm {
  title: string;
  description: string;
  type: string;
  difficulty: string;
  duration_minutes: number;
  total_questions: number;
  generate_ai: boolean;
}

const defaultForm: TestForm = {
  title: "",
  description: "",
  type: "iq",
  difficulty: "medium",
  duration_minutes: 30,
  total_questions: 10,
  generate_ai: true,
};

export default function AdminTests() {
  const { toast } = useToast();
  const [tests, setTests] = useState<any[]>([]);
  const [form, setForm] = useState<TestForm>(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchTests = async () => {
    const { data } = await supabase
      .from("tests")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTests(data);
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Judul wajib diisi", variant: "destructive" });
      return;
    }
    setSaving(true);

    try {
      let testId: string;

      if (editId) {
        // Update tes yang ada
        const { error } = await supabase
          .from("tests")
          .update({
            title: form.title,
            description: form.description,
            type: form.type,
            difficulty: form.difficulty,
            duration_minutes: form.duration_minutes,
            total_questions: form.total_questions,
          })
          .eq("id", editId);
        if (error) throw error;
        testId = editId;
        toast({ title: "Tes diperbarui" });
      } else {
        // Buat tes baru
        const { data, error } = await supabase
          .from("tests")
          .insert({
            title: form.title,
            description: form.description,
            type: form.type,
            difficulty: form.difficulty,
            duration_minutes: form.duration_minutes,
            total_questions: form.total_questions,
          })
          .select()
          .single();
        if (error) throw error;
        testId = data.id;
        toast({ title: "Tes dibuat" });
      }

      // Generate soal AI jika diaktifkan dan ini tes baru
      if (form.generate_ai && !editId) {
        setSaving(false);
        setGenerating(true);
        try {
          const { data: fnData, error: fnError } = await supabase.functions.invoke(
            "generate-questions",
            {
              body: {
                test_id: testId,              // ✅ wajib ada
                test_type: form.type,         // ✅ nama field yang benar
                difficulty: form.difficulty,
                count: form.total_questions,
              },
            }
          );

          if (fnError) throw new Error(fnError.message || "Gagal memanggil AI");
          if (!fnData?.success) throw new Error(fnData?.error || "AI gagal membuat soal");

          // ✅ Edge function sudah insert ke DB otomatis, tidak perlu insert lagi
          toast({ title: `${fnData.count} soal berhasil di-generate oleh AI!` });
        } catch (e: any) {
          toast({
            title: "Tes tersimpan, tapi gagal generate soal",
            description: e.message,
            variant: "destructive",
          });
        } finally {
          setGenerating(false);
        }
      }

      setOpen(false);
      setForm(defaultForm);
      setEditId(null);
      fetchTests();
    } catch (e: any) {
      toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus tes ini? Semua soal terkait juga akan dihapus.")) return;
    const { error } = await supabase.from("tests").delete().eq("id", id);
    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Tes dihapus" });
    fetchTests();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("tests").update({ is_active: !active }).eq("id", id);
    fetchTests();
  };

  const handleEdit = (test: any) => {
    setEditId(test.id);
    setForm({
      title: test.title,
      description: test.description || "",
      type: test.type,
      difficulty: test.difficulty,
      duration_minutes: test.duration_minutes,
      total_questions: test.total_questions,
      generate_ai: false,
    });
    setOpen(true);
  };

  const handleDialogClose = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setEditId(null);
      setForm(defaultForm);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">Kelola Tes</h1>
          <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" /> Buat Tes Baru
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editId ? "Edit Tes" : "Buat Tes Baru"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Judul</label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Contoh: Tes IQ Standar"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Deskripsi</label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Deskripsi singkat tentang tes ini"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Tipe</label>
                    <Select
                      value={form.type}
                      onValueChange={(v) => setForm({ ...form, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="iq">Uji IQ</SelectItem>
                        <SelectItem value="concentration">Konsentrasi</SelectItem>
                        <SelectItem value="mixed">Campuran</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Kesulitan</label>
                    <Select
                      value={form.difficulty}
                      onValueChange={(v) => setForm({ ...form, difficulty: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Mudah</SelectItem>
                        <SelectItem value="medium">Sedang</SelectItem>
                        <SelectItem value="hard">Sulit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Durasi (menit)</label>
                    <Input
                      type="number"
                      min={5}
                      max={120}
                      value={form.duration_minutes}
                      onChange={(e) =>
                        setForm({ ...form, duration_minutes: parseInt(e.target.value) || 30 })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Jumlah Soal</label>
                    <Input
                      type="number"
                      min={5}
                      max={50}
                      value={form.total_questions}
                      onChange={(e) =>
                        setForm({ ...form, total_questions: parseInt(e.target.value) || 10 })
                      }
                    />
                  </div>
                </div>

                {!editId && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary">
                    <Wand2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm font-medium">Generate soal dengan AI</span>
                      <p className="text-xs text-muted-foreground">
                        Soal otomatis dibuat oleh AI setelah tes disimpan
                      </p>
                    </div>
                    <Switch
                      checked={form.generate_ai}
                      onCheckedChange={(v) => setForm({ ...form, generate_ai: v })}
                    />
                  </div>
                )}

                <Button
                  onClick={handleSave}
                  disabled={saving || generating}
                  className="w-full"
                >
                  {(saving || generating) && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  {generating
                    ? "AI sedang membuat soal..."
                    : saving
                    ? "Menyimpan..."
                    : editId
                    ? "Perbarui"
                    : "Buat Tes"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judul</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Kesulitan</TableHead>
                  <TableHead>Soal</TableHead>
                  <TableHead>Durasi</TableHead>
                  <TableHead>Aktif</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{testTypeLabels[t.type] || t.type}</Badge>
                    </TableCell>
                    <TableCell>{difficultyLabels[t.difficulty] || t.difficulty}</TableCell>
                    <TableCell>{t.total_questions}</TableCell>
                    <TableCell>{t.duration_minutes}m</TableCell>
                    <TableCell>
                      <Switch
                        checked={t.is_active}
                        onCheckedChange={() => handleToggle(t.id, t.is_active)}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {tests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Belum ada tes. Klik "Buat Tes Baru" untuk memulai.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}