import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export function useRealtime<T extends Record<string, unknown>>(
  table: string,
  callback?: (payload: RealtimePostgresChangesPayload<T>) => void
) {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        (payload: RealtimePostgresChangesPayload<T>) => {
          callback?.(payload);
          if (payload.eventType === "INSERT") {
            setData((prev) => [payload.new as T, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setData((prev) =>
              prev.map((item) =>
                (item as any).id === (payload.new as any).id ? (payload.new as T) : item
              )
            );
          } else if (payload.eventType === "DELETE") {
            setData((prev) =>
              prev.filter((item) => (item as any).id !== (payload.old as any).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, callback]);

  return { data, setData };
}
