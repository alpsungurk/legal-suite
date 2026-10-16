import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Section } from "@/components/app/bits";
import { CRON_META, describeCronTr } from "@/lib/cron-display";
import { supabase } from "@/lib/supabase";

type Row = { jobname: string; schedule: string; command: string };

const FALLBACK: Row[] = [
  { jobname: "lexkasa-aylik-ucret", schedule: "10 21 * * 0", command: "" },
  { jobname: "lexkasa-bildirimler", schedule: "0 5 * * 1", command: "" },
  { jobname: "lexkasa-saklama", schedule: "30 0 * * 1", command: "" },
  { jobname: "lexkasa-keepalive", schedule: "0 6 */5 * *", command: "" },
  { jobname: "lexkasa-haciz", schedule: "0 5 * * *", command: "" },
  { jobname: "lexkasa-kapali-dosya", schedule: "45 0 1 * *", command: "" },
];

export function CronTab() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>(FALLBACK);
  const [fromServer, setFromServer] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_cron_jobs");
    setLoading(false);
    if (error) {
      setFromServer(false);
      setRows(FALLBACK);
      if (!/list_cron_jobs|function|404|PGRST/i.test(error.message)) {
        toast.error(error.message);
      }
      return;
    }
    const list = (data as Row[]) ?? [];
    setFromServer(list.length > 0);
    setRows(list.length ? list : FALLBACK);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Section
        title="Zamanlanmış işler"
        description="Sunucunun ne zaman kontrol ettiğini gösterir. Saatler sabittir; buradan değiştirilmez."
      >
        <ul className="divide-y divide-border/70">
          {rows.map((row) => {
            const meta = CRON_META[row.jobname] ?? {
              label: row.jobname,
              hint: "",
            };
            return (
              <li key={row.jobname} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary/60 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{meta.label}</p>
                  <p className="mt-0.5 text-sm text-foreground/90">
                    {describeCronTr(row.schedule)}
                  </p>
                  {meta.hint && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{meta.hint}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
      <p className="text-xs text-muted-foreground">
        {fromServer
          ? "Saatler veritabanındaki cron kayıtlarından okundu (Türkiye saati)."
          : "Sunucu listesi okunamadı; varsayılan sabit program gösteriliyor. keepalive-setup / view migration’ı uygulayın."}
      </p>
    </div>
  );
}
