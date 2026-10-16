import { toast } from "sonner";
import { FormDialog, type FormValues } from "@/components/app/FormDialog";
import { AttachmentList } from "@/components/app/files";
import { useErp } from "@/lib/erp-store";
import { useOptions } from "@/lib/options";
import {
  DEFAULT_ENFORCEMENT_STATUS,
  EVENT_TYPE_INQUIRY,
  EVENT_TYPE_SEIZURE,
  STOPPED_ENFORCEMENT_STATUS,
  isEnforcementClosed,
  type Collection,
  type ContactLog,
  type Debtor,
  type DocumentFile,
  type EnforcementEvent,
  type EnforcementFile,
  type PaymentPromise,
  type Reminder,
  type AttachmentRef,
} from "@/lib/erp-types";
import {
  addDays,
  formatDate,
  formatMoney,
  normalizeFileNo,
  round2,
  splitAmount,
  sum,
  today,
} from "@/lib/format";
import {
  caseClientId,
  defaultIncomeAccountId,
  enforcementSummary,
  seizureDueDate,
} from "@/lib/finance";
import { PERIODS, stepDate } from "@/components/forms/finance";
import { MoneyInput } from "@/components/app/fields";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/app/bits";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormProps } from "@/components/forms/core";

/* ───────────── Ajanda ───────────── */

export function ReminderForm({ open, onOpenChange, record, preset, onSaved }: FormProps<Reminder>) {
  const { save, state, currentUser } = useErp();
  const o = useOptions();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Etkinliği düzenle" : "Yeni ajanda kaydı"}
      description="Duruşma, süre, toplantı veya görev"
      wide
      fields={[
        { name: "type", label: "Tür", type: "select", options: o.reminderTypes, required: true },
        {
          name: "title",
          label: "Başlık",
          required: true,
          autoFocus: !record,
          placeholder: "Örn. Ön inceleme duruşması",
        },
        { name: "date", label: "Tarih", type: "date", required: true },
        { name: "time", label: "Saat", type: "time" },
        {
          name: "caseId",
          label: "Dosya",
          type: "combobox",
          options: o.cases,
          allowClear: true,
          onChange: (val) => (val ? { clientId: caseClientId(state, String(val)) } : {}),
        },
        {
          name: "clientId",
          label: "Müvekkil",
          type: "combobox",
          options: o.allClients,
          allowClear: true,
        },
        {
          name: "assigneeId",
          label: "Sorumlu",
          type: "combobox",
          options: o.staff,
          required: true,
        },
        { name: "location", label: "Yer", placeholder: "Örn. Çağlayan Adliyesi B Blok" },
        {
          name: "status",
          label: "Durum",
          type: "select",
          options: ["Bekliyor", "Tamamlandı", "İptal"],
          visible: () => !!record,
        },
        { name: "note", label: "Not", type: "textarea" },
      ]}
      initial={{
        type: o.reminderTypes[0],
        date: today(),
        assigneeId: currentUser.id,
        status: "Bekliyor",
        ...preset,
        ...record,
      }}
      onSubmit={(v) => {
        const assigneeChanged = !record || record.assigneeId !== v.assigneeId;
        const item = save(
          "reminders",
          {
            id: record?.id,
            title: v.title.trim(),
            type: v.type,
            date: v.date,
            time: v.time || undefined,
            location: v.location || undefined,
            caseId: v.caseId || undefined,
            clientId: v.clientId || undefined,
            enforcementId: record?.enforcementId ?? preset?.enforcementId,
            assigneeId: v.assigneeId,
            status: v.status ?? "Bekliyor",
            note: v.note || undefined,
          },
          assigneeChanged
            ? {
                notify: {
                  userIds: [v.assigneeId],
                  title: "Size yeni görev atandı",
                  link: "/takvim",
                },
              }
            : undefined,
        );
        toast.success(record ? "Kayıt güncellendi" : "Ajandaya eklendi");
        onSaved?.(item);
      }}
    />
  );
}

/* ───────────── İcra ───────────── */

export function DebtorForm({ open, onOpenChange, record, preset, onSaved }: FormProps<Debtor>) {
  const { save } = useErp();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Borçluyu düzenle" : "Yeni borçlu"}
      fields={[
        { name: "kind", label: "Tür", type: "segmented", options: ["Bireysel", "Kurumsal"] },
        { name: "name", label: "Ad soyad / Ünvan", required: true, span: 2, autoFocus: !record },
        { name: "identity", label: "TC / Vergi no" },
        { name: "phone", label: "Telefon", type: "tel" },
        { name: "email", label: "E-posta", type: "email", span: 2 },
        { name: "address", label: "Adres", type: "textarea" },
        {
          name: "assets",
          label: "Malvarlığı bilgileri",
          type: "textarea",
          placeholder: "Araç, taşınmaz, banka, maaş vb.",
        },
        { name: "notes", label: "Notlar", type: "textarea" },
      ]}
      initial={{ kind: "Bireysel", ...preset, ...record }}
      onSubmit={(v) => {
        const item = save("debtors", {
          id: record?.id,
          name: v.name.trim(),
          kind: v.kind,
          identity: v.identity || undefined,
          phone: v.phone || undefined,
          email: v.email || undefined,
          address: v.address || undefined,
          assets: v.assets || undefined,
          notes: v.notes || undefined,
        });
        toast.success(record ? "Borçlu güncellendi" : "Borçlu eklendi");
        onSaved?.(item);
      }}
    />
  );
}

export function EnforcementForm({
  open,
  onOpenChange,
  record,
  preset,
  onSaved,
}: FormProps<EnforcementFile>) {
  const { save, state, currentUser, rememberOption } = useErp();
  const o = useOptions();
  const owed = (v: FormValues) => v.side === "Borçlu";
  const months = state.settings.seizureValidMonths;
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "İcra dosyasını düzenle" : "Yeni icra dosyası"}
      wide
      fields={[
        {
          name: "side",
          label: "Taraf",
          type: "segmented",
          options: [
            { value: "Alacaklı", label: "Alacaklı olduğumuz" },
            { value: "Borçlu", label: "Borçlu olduğumuz" },
          ],
        },
        {
          name: "no",
          label: "Dosya no",
          required: true,
          autoFocus: !record,
          placeholder: "Örn. 2026/101 E.",
          hint: "Kaydederken 2026/101 E. biçimine getirilir",
        },
        {
          name: "office",
          label: "Birim (icra dairesi)",
          required: true,
          type: "combobox",
          options: o.enforcementOffices,
          creatable: true,
          placeholder: "Listeden seçin veya yazın",
        },
        { name: "type", label: "Takip türü", type: "select", options: o.enforcementTypes },
        {
          name: "status",
          label: "Dosya durumu",
          type: "select",
          options: o.enforcementStatuses,
          onChange: (val) => (val === STOPPED_ENFORCEMENT_STATUS ? {} : { stopReason: "" }),
        },
        {
          name: "stopReason",
          label: "Durdurulma sebebi",
          type: "combobox",
          options: o.enforcementStopReasons,
          creatable: true,
          required: true,
          visible: (v) => v.status === STOPPED_ENFORCEMENT_STATUS,
          placeholder: "Listeden seçin veya yazın",
        },
        {
          name: "clientId",
          label: (v) => (owed(v) ? "Borçlu (müvekkilimiz)" : "Alacaklı (müvekkilimiz)"),
          type: "combobox",
          options: o.allClients,
          required: true,
        },
        {
          name: "debtorIds",
          label: (v) => (owed(v) ? "Alacaklı (karşı taraf)" : "Borçlular"),
          type: "multiselect",
          options: o.debtors,
          required: true,
          hint: "Kartı yoksa önce Borçlular sayfasından ekleyin",
        },
        {
          name: "principal",
          label: "Takip çıkış rakamı",
          type: "money",
          required: true,
          hint: "Asıl alacak + takip tarihine kadar işleyen faiz + masraflar toplamı",
        },
        { name: "openingDate", label: "Takip tarihi", type: "date", required: true },
        {
          name: "lastSeizureDate",
          label: "Son haciz tarihi",
          type: "date",
          visible: (v) => !owed(v),
          hint: (v) =>
            v.lastSeizureDate
              ? `Haczin düşeceği tarih: ${formatDate(seizureDueDate(v, months))} (${months} ay)`
              : `Haczin düşmesinden ${state.settings.seizureReminderDays} gün önce hatırlatılır`,
        },
        {
          name: "responsibleIds",
          label: "Sorumlu avukat",
          type: "multiselect",
          options: o.lawyers,
        },
        {
          name: "caseId",
          label: "İlgili dava dosyası",
          type: "combobox",
          options: o.cases,
          allowClear: true,
        },
        {
          name: "details",
          label: "Takip bilgileri",
          type: "textarea",
          placeholder:
            "Dosyaya özgü bilgiler: alacağın niteliği (çek, bono…), örnek alınacak ayrıntılar, ilgili dosya…",
        },
        { name: "note", label: "Açıklamalar", type: "textarea" },
      ]}
      initial={{
        side: "Alacaklı",
        type: o.enforcementTypes.includes("İlamsız") ? "İlamsız" : o.enforcementTypes[0],
        status: o.enforcementStatuses.includes(DEFAULT_ENFORCEMENT_STATUS)
          ? DEFAULT_ENFORCEMENT_STATUS
          : o.enforcementStatuses[0],
        openingDate: today(),
        debtorIds: [],
        responsibleIds: currentUser.role === "Avukat" ? [currentUser.id] : [],
        ...preset,
        ...record,
        // Asıl / faiz / masraf ayrımı kaldırıldı: eski kayıtta toplamı tek tutar olarak gösterilir
        principal: record
          ? round2(record.principal + record.interest + record.costs)
          : preset?.principal,
      }}
      onSubmit={(v) => {
        rememberOption("enforcementOffices", v.office);
        const stopped = v.status === STOPPED_ENFORCEMENT_STATUS;
        if (stopped) rememberOption("enforcementStopReasons", v.stopReason);
        const item = save("enforcements", {
          id: record?.id,
          side: owed(v) ? "Borçlu" : "Alacaklı",
          no: normalizeFileNo(v.no),
          office: v.office.trim(),
          type: v.type,
          status: v.status,
          stopReason: stopped ? String(v.stopReason ?? "").trim() : "",
          clientId: v.clientId,
          debtorIds: v.debtorIds,
          principal: round2(Number(v.principal) || 0),
          interest: 0,
          costs: 0,
          openingDate: v.openingDate,
          lastSeizureDate: owed(v) ? "" : v.lastSeizureDate || "",
          responsibleIds: v.responsibleIds ?? [],
          caseId: v.caseId || undefined,
          details: v.details?.trim() || "",
          note: v.note?.trim() || "",
        });
        toast.success(record ? "İcra dosyası güncellendi" : "İcra dosyası açıldı");
        onSaved?.(item);
      }}
    />
  );
}

/** İcra işlem geçmişi kaydı: tebliğ, itiraz, sorgu, haciz, banka cevabı... */
export function EnforcementEventForm({
  open,
  onOpenChange,
  record,
  preset,
  onSaved,
}: FormProps<EnforcementEvent>) {
  const { save, patch, state } = useErp();
  const o = useOptions();
  const enfId = record?.enforcementId ?? preset?.enforcementId;
  const ef = state.enforcements.find((e) => e.id === enfId);
  const parties = state.debtors
    .filter((d) => ef?.debtorIds.includes(d.id))
    .map((d) => ({ value: d.id, label: d.name }));
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "İşlemi düzenle" : "İşlem ekle"}
      description={ef ? `${ef.no} · ${ef.office}` : undefined}
      fields={[
        { name: "date", label: "Tarih", type: "date", required: true },
        {
          name: "type",
          label: "İşlem türü",
          type: "combobox",
          options: o.enforcementEventTypes,
          creatable: true,
          required: true,
        },
        {
          name: "inquiryType",
          label: "Sorgu türü",
          type: "select",
          options: o.inquiryTypes,
          visible: (v) => v.type === EVENT_TYPE_INQUIRY,
        },
        {
          name: "seizureType",
          label: "Haciz türü",
          type: "select",
          options: o.seizureTypes,
          visible: (v) => v.type === EVENT_TYPE_SEIZURE,
        },
        {
          name: "debtorId",
          label: ef?.side === "Borçlu" ? "Karşı taraf" : "Borçlu",
          type: "combobox",
          options: parties,
          allowClear: true,
          placeholder: "Tümü",
        },
        { name: "result", label: "Sonuç", type: "select", options: o.resultTypes },
        { name: "amount", label: "Tutar (varsa)", type: "money" },
        { name: "note", label: "Not", type: "textarea" },
      ]}
      initial={{ date: today(), ...preset, ...record }}
      onSubmit={(v) => {
        if (!enfId) return false;
        const type = String(v.type).trim();
        const item = save("events", {
          id: record?.id,
          enforcementId: enfId,
          date: v.date,
          type,
          debtorId: v.debtorId || "",
          inquiryType: type === EVENT_TYPE_INQUIRY ? v.inquiryType || "" : "",
          seizureType: type === EVENT_TYPE_SEIZURE ? v.seizureType || "" : "",
          result: v.result || "",
          amount: Number(v.amount) > 0 ? round2(Number(v.amount)) : undefined,
          note: v.note?.trim() || "",
        });
        // Haciz kaydı dosyanın son haciz tarihini ileri taşır (geri almaz)
        if (
          ef &&
          type === EVENT_TYPE_SEIZURE &&
          ef.side !== "Borçlu" &&
          (!ef.lastSeizureDate || v.date > ef.lastSeizureDate)
        ) {
          patch("enforcements", ef.id, { lastSeizureDate: v.date });
          toast.info(`Son haciz tarihi ${formatDate(v.date)} olarak güncellendi`);
        }
        toast.success(record ? "İşlem güncellendi" : "İşlem eklendi");
        onSaved?.(item);
      }}
    />
  );
}

export function PromiseForm({ open, onOpenChange, record, preset }: FormProps<PaymentPromise>) {
  const { save, state } = useErp();
  const debtorsOf = (enfId?: string) => {
    const ef = state.enforcements.find((e) => e.id === enfId);
    return state.debtors
      .filter((d) => ef?.debtorIds.includes(d.id))
      .map((d) => ({ value: d.id, label: d.name }));
  };
  // Borçlu olduğumuz dosyalarda tahsilat, söz ve plan yok
  const enfOpts = state.enforcements
    .filter((e) => e.side !== "Borçlu" || e.id === (record?.enforcementId ?? preset?.enforcementId))
    .map((e) => ({ value: e.id, label: e.no }));
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Ödeme sözünü düzenle" : "Ödeme sözü"}
      description="Borçlunun verdiği ödeme taahhüdü; vadesinde takip edilir."
      fields={[
        {
          name: "enforcementId",
          label: "İcra dosyası",
          type: "combobox",
          options: enfOpts,
          required: true,
          onChange: (val) => ({ debtorId: debtorsOf(String(val))[0]?.value }),
        },
        {
          name: "debtorId",
          label: "Borçlu",
          type: "combobox",
          options: state.debtors.map((d) => ({ value: d.id, label: d.name })),
          required: true,
        },
        { name: "amount", label: "Tutar", type: "money", required: true },
        { name: "dueDate", label: "Söz tarihi", type: "date", required: true },
        {
          name: "status",
          label: "Durum",
          type: "select",
          options: ["Bekliyor", "Tutuldu", "Tutulmadı", "İptal"],
          visible: () => !!record,
        },
        { name: "note", label: "Not", type: "textarea" },
      ]}
      initial={{
        dueDate: addDays(today(), 7),
        status: "Bekliyor",
        ...preset,
        debtorId: preset?.debtorId ?? debtorsOf(preset?.enforcementId)[0]?.value,
        ...record,
      }}
      onSubmit={(v) => {
        save("promises", {
          id: record?.id,
          enforcementId: v.enforcementId,
          debtorId: v.debtorId,
          amount: Number(v.amount),
          dueDate: v.dueDate,
          status: v.status ?? "Bekliyor",
          note: v.note || undefined,
        });
        toast.success("Ödeme sözü kaydedildi");
      }}
    />
  );
}

/* ───────────── Borçlu taksit planı ───────────── */

type DebtorRow = { dueDate: string; amount: number };

function regenDebtorRows(v: FormValues): DebtorRow[] {
  const total = Number(v.total) || 0;
  const down = Math.min(Number(v.downPayment) || 0, total);
  const count = Math.max(1, Math.min(Number(v.count) || 1, 60));
  const rows: DebtorRow[] = [];
  if (down > 0) rows.push({ dueDate: v.startDate, amount: down });
  splitAmount(round2(total - down), count).forEach((amount, i) =>
    rows.push({ dueDate: stepDate(v.firstDue || v.startDate, v.period, i), amount }),
  );
  return rows;
}

/** Borçluya icra dosyası için taksit tanımlar; her taksit vadesi takip edilen bir kayıt olur. */
export function DebtorPlanForm({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preset?: { enforcementId?: string; debtorId?: string; total?: number };
}) {
  const { createDebtorPlan, state } = useErp();
  // Borçlu olduğumuz dosyalarda tahsilat, söz ve plan yok
  const enfOpts = state.enforcements
    .filter((e) => e.side !== "Borçlu" || e.id === preset?.enforcementId)
    .map((e) => ({ value: e.id, label: e.no }));
  const debtorsOf = (enfId?: string) => {
    const ef = state.enforcements.find((e) => e.id === enfId);
    return state.debtors
      .filter((d) => ef?.debtorIds.includes(d.id))
      .map((d) => ({ value: d.id, label: d.name }));
  };
  const remainingOf = (enfId?: string) => (enfId ? enforcementSummary(state, enfId).remaining : 0);
  const regenOn = (name: string) => (val: unknown, v: FormValues) => ({
    rows: regenDebtorRows({ ...v, [name]: val }),
  });
  const base: FormValues = {
    enforcementId: preset?.enforcementId,
    debtorId: preset?.debtorId ?? debtorsOf(preset?.enforcementId)[0]?.value,
    total: preset?.total ?? remainingOf(preset?.enforcementId),
    downPayment: 0,
    count: 6,
    period: "Aylık",
    startDate: today(),
    firstDue: addDays(today(), 30),
  };
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Borçluya taksit tanımla"
      description="Borçlunun ödeme planını taksitlere bölün; her taksit vadesinde takip edilir ve icra dosyasında görünür."
      wide
      fields={[
        {
          name: "enforcementId",
          label: "İcra dosyası",
          type: "combobox",
          options: enfOpts,
          required: true,
          onChange: (val, v) => ({
            debtorId: debtorsOf(String(val))[0]?.value,
            total: remainingOf(String(val)),
            rows: regenDebtorRows({ ...v, total: remainingOf(String(val)) }),
          }),
        },
        {
          name: "debtorId",
          label: "Borçlu",
          type: "combobox",
          options: state.debtors.map((d) => ({ value: d.id, label: d.name })),
          required: true,
        },
        {
          name: "total",
          label: "Taksitlendirilecek tutar",
          type: "money",
          required: true,
          onChange: regenOn("total"),
        },
        {
          name: "downPayment",
          label: "Peşinat",
          type: "money",
          onChange: regenOn("downPayment"),
        },
        {
          name: "count",
          label: "Taksit sayısı",
          type: "number",
          onChange: regenOn("count"),
        },
        {
          name: "startDate",
          label: "Peşinat / başlangıç tarihi",
          type: "date",
          required: true,
          onChange: regenOn("startDate"),
        },
        {
          name: "firstDue",
          label: "İlk taksit vadesi",
          type: "date",
          onChange: regenOn("firstDue"),
        },
        {
          name: "period",
          label: "Sıklık",
          type: "select",
          options: [...PERIODS],
          onChange: regenOn("period"),
        },
        { name: "note", label: "Not", type: "textarea" },
      ]}
      initial={{ ...base, rows: regenDebtorRows(base) }}
      validate={(v) => {
        const rows: DebtorRow[] = v.rows ?? [];
        if (!rows.length) return { _form: "En az bir taksit olmalı" };
        if (rows.some((r) => !r.dueDate || r.amount <= 0))
          return { _form: "Her taksitin tarihi ve tutarı olmalı" };
        const rowSum = sum(rows.map((r) => r.amount));
        if (Math.abs(rowSum - round2(Number(v.total) || 0)) > 0.009)
          return {
            _form: `Taksitlerin toplamı (${formatMoney(rowSum)}) tutarla (${formatMoney(Number(v.total) || 0)}) eşleşmiyor.`,
          };
        return undefined;
      }}
      onSubmit={(v) => {
        createDebtorPlan({
          enforcementId: v.enforcementId,
          debtorId: v.debtorId,
          rows: v.rows,
          note: v.note || undefined,
        });
        toast.success(`${(v.rows as DebtorRow[]).length} taksit tanımlandı`);
      }}
    >
      {(v, set) => {
        const rows: DebtorRow[] = v.rows ?? [];
        const total = round2(Number(v.total) || 0);
        const rowSum = sum(rows.map((r) => r.amount));
        const diff = round2(total - rowSum);
        const update = (i: number, patch: Partial<DebtorRow>) =>
          set({ rows: rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
        return (
          <div className="overflow-hidden rounded-xl border border-border/80">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5">
              <p className="text-[14px] font-semibold">Taksit tablosu</p>
              <p
                className={cn(
                  "text-xs font-medium",
                  Math.abs(diff) > 0.009 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                Toplam <Money value={rowSum} className="font-semibold text-foreground" />
                {Math.abs(diff) > 0.009 && <> · fark {formatMoney(diff)}</>}
              </p>
            </div>
            <div className="max-h-64 divide-y divide-border/60 overflow-y-auto">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2 px-3 py-2"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs font-semibold">
                    {i + 1}
                  </span>
                  <Input
                    type="date"
                    value={r.dueDate}
                    onChange={(e) => update(i, { dueDate: e.target.value })}
                    className="h-9"
                  />
                  <MoneyInput value={r.amount} onChange={(n) => update(i, { amount: n })} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={rows.length <= 1}
                    onClick={() => set({ rows: rows.filter((_, idx) => idx !== i) })}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Taksiti sil"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/20 px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  set({
                    rows: [
                      ...rows,
                      {
                        dueDate: stepDate(rows[rows.length - 1]?.dueDate ?? today(), "Aylık", 1),
                        amount: diff > 0 ? diff : 0,
                      },
                    ],
                  })
                }
              >
                <Plus /> Taksit ekle
              </Button>
              {Math.abs(diff) > 0.009 && rows.length > 0 && (
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  onClick={() =>
                    update(rows.length - 1, {
                      amount: round2(rows[rows.length - 1].amount + diff),
                    })
                  }
                >
                  Farkı son taksite ekle
                </Button>
              )}
            </div>
          </div>
        );
      }}
    </FormDialog>
  );
}

export function CollectionForm({ open, onOpenChange, record, preset }: FormProps<Collection>) {
  const { save, patch, state } = useErp();
  const o = useOptions();
  // Borçlu olduğumuz dosyalarda tahsilat, söz ve plan yok
  const enfOpts = state.enforcements
    .filter((e) => e.side !== "Borçlu" || e.id === (record?.enforcementId ?? preset?.enforcementId))
    .map((e) => ({ value: e.id, label: e.no }));
  const openPromises = state.promises
    .filter((p) => p.status === "Bekliyor")
    .map((p) => ({
      value: p.id,
      label: `${formatMoney(p.amount)} · ${p.dueDate}`,
      hint: state.enforcements.find((e) => e.id === p.enforcementId)?.no,
    }));
  const promiseOpts = (v: FormValues) =>
    state.promises
      .filter((p) => p.enforcementId === v.enforcementId && p.status === "Bekliyor")
      .map((p) => ({ value: p.id, label: `${formatMoney(p.amount)} · ${p.dueDate}` }));
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Tahsilatı düzenle" : "İcra tahsilatı"}
      description="Borçludan tahsil edilen tutar müvekkilin cari hesabına alacak olarak yazılır."
      fields={[
        {
          name: "enforcementId",
          label: "İcra dosyası",
          type: "combobox",
          options: enfOpts,
          required: true,
        },
        { name: "debtorId", label: "Borçlu", type: "combobox", options: o.debtors, required: true },
        { name: "amount", label: "Tutar", type: "money", required: true, autoFocus: true },
        { name: "date", label: "Tarih", type: "date", required: true },
        { name: "method", label: "Yöntem", type: "select", options: o.paymentMethods },
        {
          name: "accountId",
          label: "Yatırılan hesap",
          type: "combobox",
          options: o.accounts,
          required: true,
        },
        {
          name: "promiseId",
          label: "Karşılanan ödeme sözü",
          type: "combobox",
          options: openPromises,
          allowClear: true,
          visible: () => !record,
        },
        { name: "transferredToClient", label: "Müvekkile aktarıldı", type: "switch" },
        { name: "note", label: "Not", type: "textarea" },
      ]}
      initial={{
        date: today(),
        method: o.paymentMethods.includes("Havale/EFT") ? "Havale/EFT" : o.paymentMethods[0],
        transferredToClient: false,
        accountId: defaultIncomeAccountId(state),
        ...preset,
        ...record,
      }}
      validate={(v) => {
        const opts = promiseOpts(v);
        if (v.promiseId && !opts.some((p) => p.value === v.promiseId))
          return { promiseId: "Bu söz seçili icra dosyasına ait değil" };
        return undefined;
      }}
      onSubmit={(v) => {
        save("collections", {
          id: record?.id,
          enforcementId: v.enforcementId,
          debtorId: v.debtorId,
          amount: Number(v.amount),
          date: v.date,
          method: v.method,
          accountId: v.accountId,
          promiseId: v.promiseId || record?.promiseId,
          transferredToClient: !!v.transferredToClient,
          note: v.note || undefined,
        });
        if (v.promiseId) patch("promises", v.promiseId, { status: "Tutuldu" });
        // Alacağın tamamı tahsil edildiyse icra dosyası kendiliğinden "Tahsil edildi" olur
        const ef = state.enforcements.find((e) => e.id === v.enforcementId);
        const others = state.collections
          .filter((c) => c.enforcementId === v.enforcementId && c.id !== record?.id)
          .reduce((t, c) => t + c.amount, 0);
        const claim = ef ? ef.principal + ef.interest + ef.costs : 0;
        if (
          ef &&
          claim > 0 &&
          others + Number(v.amount) >= claim - 0.005 &&
          !isEnforcementClosed(ef.status)
        ) {
          patch("enforcements", ef.id, { status: "Tahsil edildi" });
          toast.success("Tahsilat kaydedildi", {
            description: `Alacağın tamamı tahsil edildi; ${ef.no} "Tahsil edildi" yapıldı.`,
          });
        } else toast.success("Tahsilat kaydedildi");
      }}
    />
  );
}

export function ContactForm({ open, onOpenChange, record, preset }: FormProps<ContactLog>) {
  const { save, currentUser } = useErp();
  const o = useOptions();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Görüşme notu"
      fields={[
        { name: "debtorId", label: "Borçlu", type: "combobox", options: o.debtors, required: true },
        {
          name: "enforcementId",
          label: "İcra dosyası",
          type: "combobox",
          options: o.enforcements,
          allowClear: true,
        },
        { name: "channel", label: "Kanal", type: "segmented", options: o.contactChannels },
        { name: "date", label: "Tarih", type: "date", required: true },
        { name: "note", label: "Görüşme özeti", type: "textarea", required: true },
      ]}
      initial={{ channel: "Telefon", date: today(), ...preset, ...record }}
      onSubmit={(v) => {
        save("contacts", {
          id: record?.id,
          debtorId: v.debtorId,
          enforcementId: v.enforcementId || undefined,
          channel: v.channel,
          date: v.date,
          note: v.note.trim(),
          userId: record?.userId ?? currentUser.id,
        });
        toast.success("Görüşme notu eklendi");
      }}
    />
  );
}

/* ───────────── Belgeler ───────────── */

export function DocumentForm({ open, onOpenChange, record, preset }: FormProps<DocumentFile>) {
  const { save, state, currentUser } = useErp();
  const o = useOptions();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Belgeyi düzenle" : "Belge yükle"}
      fields={[
        { name: "category", label: "Kategori", type: "select", options: o.documentCategories },
        {
          name: "caseId",
          label: "Dosya",
          type: "combobox",
          options: o.cases,
          allowClear: true,
          onChange: (val) => (val ? { clientId: caseClientId(state, String(val)) } : {}),
        },
        {
          name: "clientId",
          label: "Müvekkil",
          type: "combobox",
          options: o.allClients,
          allowClear: true,
        },
        { name: "name", label: "Belge adı", visible: () => !!record, span: 2 },
      ]}
      initial={{
        category: "Diğer",
        files: [] as AttachmentRef[],
        ...preset,
        ...record,
      }}
      validate={(v) =>
        !record && !(v.files as AttachmentRef[]).length
          ? { _form: "En az bir dosya seçin" }
          : undefined
      }
      onSubmit={(v) => {
        if (record) {
          save("documents", {
            ...record,
            name: v.name || record.name,
            category: v.category,
            caseId: v.caseId || undefined,
            clientId: v.clientId || undefined,
          });
          toast.success("Belge güncellendi");
          return;
        }
        for (const file of v.files as AttachmentRef[]) {
          save("documents", {
            name: file.name,
            category: v.category,
            attachment: file,
            caseId: v.caseId || undefined,
            clientId: v.clientId || undefined,
            uploadedBy: currentUser.id,
          });
        }
        toast.success("Belge yüklendi");
      }}
    >
      {(v, set) =>
        !record ? (
          <AttachmentList files={v.files ?? []} onChange={(files) => set({ files })} />
        ) : null
      }
    </FormDialog>
  );
}
