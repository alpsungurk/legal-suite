import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { PROCEDURE_ACTIONS, type Procedure } from "@/lib/erp-types";
import { Section } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Access = { view: boolean; create: boolean; edit: boolean; delete: boolean };
type Row = { name: string; days: string; action: string };

const NONE = "__none";
const toRows = (ps: Procedure[]): Row[] =>
  ps.map((p) => ({
    name: p.name,
    days: p.days == null ? "" : String(p.days),
    action: p.action ?? "",
  }));

/**
 * Takip şekilleri (Örnek No) ve süreleri: ödeme emri tebliğinden itibaren "gün" dolunca
 * ertesi gün kesinleştirme / tahliye hatırlatılır. Ayrıca 89/1 ve maaş haczi süreleri.
 */
export function IcraRulesSettings({ access }: { access: Access }) {
  const { state, updateSettings } = useErp();
  const s = state.settings;
  const [rows, setRows] = useState<Row[]>(() => toRows(s.procedures));
  const [bank, setBank] = useState(String(s.bankResponseDays));
  const [salary, setSalary] = useState(String(s.salaryResponseDays));
  useEffect(() => setRows(toRows(s.procedures)), [s.procedures]);
  useEffect(() => {
    setBank(String(s.bankResponseDays));
    setSalary(String(s.salaryResponseDays));
  }, [s.bankResponseDays, s.salaryResponseDays]);

  const update = (i: number, p: Partial<Row>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const dirty = JSON.stringify(rows) !== JSON.stringify(toRows(s.procedures));
  const used = new Set(state.enforcements.map((e) => e.procedure).filter(Boolean));

  const saveProcedures = () => {
    const out: Procedure[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const name = r.name.replace(/\s+/g, " ").trim();
      if (!name) return toast.error("Takip şekli adı boş olamaz");
      const k = name.toLocaleLowerCase("tr");
      if (seen.has(k)) return toast.error(`İki kez yazılmış: ${name}`);
      seen.add(k);
      const days = r.days.trim() === "" ? null : Number(r.days);
      if (days != null && !(Number.isInteger(days) && days >= 1 && days <= 365))
        return toast.error(`${name}: gün 1–365 arası olmalı ya da boş bırakılmalı`);
      if (days != null && !r.action)
        return toast.error(`${name}: süre dolunca ne yapılacağını seçin`);
      out.push({ name, days, action: days == null ? null : r.action });
    }
    updateSettings({ procedures: out });
    toast.success("Takip şekilleri kaydedildi");
  };

  const b = Number(bank);
  const m = Number(salary);
  const daysValid =
    Number.isInteger(b) && b >= 1 && b <= 60 && Number.isInteger(m) && m >= 1 && m <= 120;
  const daysDirty = b !== s.bankResponseDays || m !== s.salaryResponseDays;

  return (
    <div className="space-y-4">
      <Section
        title="Takip şekilleri ve süreleri"
        description="Dosyada seçilen takip şekline göre, ödeme emri tebliğinden itibaren süre dolunca ertesi gün kesinleştirme ya da tahliye hatırlatılır (ör. Örnek No: 7 → 7 gün, 8. gün kesinleştirme). Gün boşsa hatırlatma yapılmaz."
      >
        <p className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Buradaki gün sayıları başlangıç için örnek olarak girilmiştir. Büronuzun uygulamasına göre
          kontrol edip gerekirse düzeltin; hatırlatmalar bu günlere göre hesaplanır.
        </p>
        <div inert={!access.edit} className={cn("space-y-2", !access.edit && "opacity-60")}>
          <div className="hidden grid-cols-[minmax(0,1fr)_96px_150px_36px] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
            <span>Takip şekli</span>
            <span>Gün</span>
            <span>Süre dolunca</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_80px] gap-2 rounded-lg bg-secondary/30 p-2 sm:grid-cols-[minmax(0,1fr)_96px_150px_36px] sm:bg-transparent sm:p-0"
            >
              <Input
                value={r.name}
                className="h-9"
                placeholder="Örnek No: …"
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <Input
                type="number"
                min={1}
                max={365}
                value={r.days}
                className="h-9"
                placeholder="—"
                onChange={(e) =>
                  update(i, {
                    days: e.target.value,
                    action: e.target.value && !r.action ? PROCEDURE_ACTIONS[0] : r.action,
                  })
                }
              />
              <Select
                value={r.days ? r.action || PROCEDURE_ACTIONS[0] : NONE}
                disabled={!r.days}
                onValueChange={(v) => update(i, { action: v === NONE ? "" : v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} disabled>
                    Hatırlatma yok
                  </SelectItem>
                  {PROCEDURE_ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 justify-self-end"
                disabled={!access.delete || used.has(r.name)}
                title={used.has(r.name) ? "Bu takip şekli dosyalarda kullanılıyor" : "Sil"}
                aria-label={`${r.name} sil`}
                onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            {access.create && (
              <Button
                type="button"
                variant="soft"
                size="sm"
                onClick={() => setRows((r) => [...r, { name: "", days: "", action: "" }])}
              >
                <Plus /> Takip şekli ekle
              </Button>
            )}
            <Button type="button" size="sm" disabled={!dirty} onClick={saveProcedures}>
              Kaydet
            </Button>
            {dirty && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setRows(toRows(s.procedures))}
              >
                Vazgeç
              </Button>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="Banka ve maaş haczi süreleri"
        description="89/1 → 89/2 → 89/3 zincirinde cevap vermeyen banka için süre dolunca (gün + 1) hatırlatılır. 89/3'ten sonra menfi tespit davası yoksa aynı süreyle banka haczi kesinleşmesi hatırlatılır. Maaş haczi tebliğinden sonra işverenin borçlu eklenmesi hatırlatılır."
      >
        <form
          inert={!access.edit}
          className={cn("flex flex-wrap items-end gap-3", !access.edit && "opacity-60")}
          onSubmit={(e) => {
            e.preventDefault();
            if (!daysValid) {
              toast.error("Banka süresi 1–60, maaş süresi 1–120 gün olmalı");
              return;
            }
            updateSettings({ bankResponseDays: b, salaryResponseDays: m });
            toast.success("Süreler kaydedildi");
          }}
        >
          <label className="space-y-1.5">
            <span className="text-[14px] font-medium">89/1–89/3 cevap süresi (gün)</span>
            <Input
              type="number"
              min={1}
              max={60}
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="w-40"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-[14px] font-medium">Maaş haczi ödeme süresi (gün)</span>
            <Input
              type="number"
              min={1}
              max={120}
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-40"
            />
          </label>
          <Button type="submit" disabled={!daysDirty}>
            Kaydet
          </Button>
        </form>
      </Section>
    </div>
  );
}
