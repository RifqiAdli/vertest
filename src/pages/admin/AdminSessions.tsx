import { useEffect, useState, useCallback } from "react";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import AdminLayout from "@/components/layout/AdminLayout";
import { formatRelative } from "@/utils/formatters";

export default function AdminSessions() {
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [completedSessions, setCompletedSessions] = useState<any[]>([]);

  const fetchSessions = useCallback(async () => {
    const { data: active } = await supabase
      .from("sessions")
      .select("*, tests(title, total_questions, duration_minutes)")
      .eq("status", "in_progress")
      .order("started_at", { ascending: false });
    
    const { data: completed } = await supabase
      .from("sessions")
      .select("*, tests(title)")
      .neq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(50);

    if (active) setActiveSessions(active);
    if (completed) setCompletedSessions(completed);
  }, []);

  useRealtime("sessions", fetchSessions);
  useRealtime("answers", fetchSessions);

  useEffect(() => { fetchSessions(); }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold">Monitor Sesi</h1>
          {activeSessions.length > 0 && (
            <Badge variant="destructive" className="animate-pulse-live">
              <Activity className="h-3 w-3 mr-1" /> {activeSessions.length} LIVE
            </Badge>
          )}
        </div>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Sesi Berlangsung</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSessions.map((s) => {
                const elapsed = Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000);
                const total = (s.tests?.duration_minutes || 30) * 60;
                const progress = Math.min(100, (elapsed / total) * 100);

                return (
                  <Card key={s.id} className="border-success/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{s.participant_name}</span>
                        <span className="h-2 w-2 rounded-full bg-success animate-pulse-live" />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{s.tests?.title}</p>
                      <Progress value={progress} className="h-1.5 mb-1" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{Math.floor(elapsed / 60)}m berlalu</span>
                        <span>{s.tests?.duration_minutes}m total</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Sessions */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Sesi Selesai</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peserta</TableHead>
                  <TableHead>Tes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Waktu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedSessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.participant_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.tests?.title}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "completed" ? "secondary" : "outline"}>
                        {s.status === "completed" ? "Selesai" : "Ditinggalkan"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatRelative(s.started_at)}</TableCell>
                  </TableRow>
                ))}
                {completedSessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Belum ada sesi</TableCell>
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
