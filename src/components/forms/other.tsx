import { toast } from "sonner";
import { FormDialog, type FormValues } from "@/components/app/FormDialog";
import { AttachmentList } from "@/components/app/files";
import { useErp } from "@/lib/erp-store";
import { useOptions } from "@/lib/options";
import {
  CONTACT_CHANNELS,
  ENFORCEMENT_STATUSES,
  ENFORCEMENT_TYPES,
  PAYMENT_METHODS,
  type Collection,
  type ContactLog,
  type Debtor,
  type DocumentFile,
  type DocumentRequest,
  type EnforcementFile,
  type PaymentPromise,
  type Reminder,
  type AttachmentRef,
} from "@/lib/erp-types";
import { addDays, formatMoney, today } from "@/lib/format";
import { caseClientId } from "@/lib/finance";
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
        {
          name: "portalVisible",
          label: "Müvekkil portalında göster",
          type: "switch",
          visible: (v) => !!v.clientId,
        },
        { name: "note", label: "Not", type: "textarea" },
      ]}
      initial={{
        type: o.reminderTypes[0],
        date: today(),
        assigneeId: currentUser.id,
        status: "Bekliyor",
        portalVisible: false,
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
            portalVisible: !!v.portalVisible && !!v.clientId,
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
  const { save, currentUser } = useErp();
  const o = useOptions();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "İcra dosyasını düzenle" : "Yeni icra dosyası"}
      wide
      fields={[
        {
          name: "no",
          label: "Esas no",
          required: true,
          autoFocus: !record,
          placeholder: "Örn. 2026/4521 E.",
        },
        {
          name: "office",
          label: "İcra dairesi",
          required: true,
          placeholder: "Örn. İstanbul 14. İcra Dairesi",
        },
        { name: "type", label: "Takip türü", type: "select", options: [...ENFORCEMENT_TYPES] },
        { name: "status", label: "Durum", type: "select", options: [...ENFORCEMENT_STATUSES] },
        {
          name: "clientId",
          label: "Alacaklı müvekkil",
          type: "combobox",
          options: o.allClients,
          required: true,
        },
        {
          name: "debtorIds",
          label: "Borçlular",
          type: "multiselect",
          options: o.debtors,
          required: true,
          hint: "Önce borçlu kartı oluşturun",
        },
        {
          name: "principal",
          label: "Asıl alacak",
          type: "money",
          required: true,
          section: "Alacak kalemleri",
        },
        { name: "interest", label: "İşlemiş faiz", type: "money" },
        { name: "costs", label: "Takip masrafları", type: "money" },
        { name: "openingDate", label: "Takip tarihi", type: "date", required: true },
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
        { name: "note", label: "Not", type: "textarea" },
      ]}
      initial={{
        type: "İlamsız",
        status: "Derdest",
        openingDate: today(),
        debtorIds: [],
        interest: 0,
        costs: 0,
        responsibleIds: currentUser.role === "Avukat" ? [currentUser.id] : [],
        ...preset,
        ...record,
      }}
      onSubmit={(v) => {
        const item = save("enforcements", {
          id: record?.id,
          no: v.no.trim(),
          office: v.office.trim(),
          type: v.type,
          status: v.status,
          clientId: v.clientId,
          debtorIds: v.debtorIds,
          principal: Number(v.principal) || 0,
          interest: Number(v.interest) || 0,
          costs: Number(v.costs) || 0,
          openingDate: v.openingDate,
          responsibleIds: v.responsibleIds ?? [],
          caseId: v.caseId || undefined,
          note: v.note || undefined,
        });
        toast.success(record ? "İcra dosyası güncellendi" : "İcra dosyası açıldı");
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
  const enfOpts = state.enforcements.map((e) => ({ value: e.id, label: e.no }));
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

export function CollectionForm({ open, onOpenChange, record, preset }: FormProps<Collection>) {
  const { save, patch, state } = useErp();
  const o = useOptions();
  const enfOpts = state.enforcements.map((e) => ({ value: e.id, label: e.no }));
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
        { name: "method", label: "Yöntem", type: "select", options: [...PAYMENT_METHODS] },
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
        method: "Havale/EFT",
        transferredToClient: false,
        accountId: state.accounts.find((a) => a.type === "Banka")?.id,
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
        toast.success("Tahsilat kaydedildi");
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
        { name: "channel", label: "Kanal", type: "segmented", options: [...CONTACT_CHANNELS] },
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

export function DocumentForm({
  open,
  onOpenChange,
  record,
  preset,
}: FormProps<DocumentFile> & { preset?: Partial<DocumentFile> & { requestId?: string } }) {
  const { save, patch, state, currentUser } = useErp();
  const o = useOptions();
  const isPortal = currentUser.role === "Müvekkil";
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
          options: isPortal
            ? o.cases.filter(
                (c) => state.cases.find((x) => x.id === c.value)?.clientId === currentUser.clientId,
              )
            : o.cases,
          allowClear: true,
          onChange: (val) => (val ? { clientId: caseClientId(state, String(val)) } : {}),
        },
        {
          name: "clientId",
          label: "Müvekkil",
          type: "combobox",
          options: o.allClients,
          allowClear: true,
          visible: () => !isPortal,
        },
        {
          name: "visibleToClient",
          label: "Müvekkil portalında göster",
          type: "switch",
          visible: () => !isPortal,
        },
        { name: "name", label: "Belge adı", visible: () => !!record, span: 2 },
      ]}
      initial={{
        category: "Diğer",
        files: [] as AttachmentRef[],
        visibleToClient: isPortal,
        clientId: isPortal ? currentUser.clientId : undefined,
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
            visibleToClient: !!v.visibleToClient,
          });
          toast.success("Belge güncellendi");
          return;
        }
        let firstId: string | undefined;
        for (const file of v.files as AttachmentRef[]) {
          const doc = save(
            "documents",
            {
              name: file.name,
              category: v.category,
              attachment: file,
              caseId: v.caseId || undefined,
              clientId: (isPortal ? currentUser.clientId : v.clientId) || undefined,
              uploadedBy: currentUser.id,
              visibleToClient: isPortal ? true : !!v.visibleToClient,
              requestId: preset?.requestId,
            },
            isPortal
              ? {
                  notify: {
                    userIds: [
                      ...state.users
                        .filter((u) => u.role === "Admin" || u.role === "Sekreter")
                        .map((u) => u.id),
                      ...state.cases
                        .filter((c) => c.clientId === currentUser.clientId)
                        .flatMap((c) => c.responsibleIds),
                    ],
                    title: "Müvekkil belge yükledi",
                    link: "/belgeler",
                  },
                }
              : undefined,
          );
          firstId ??= doc.id;
        }
        if (preset?.requestId)
          patch("docRequests", preset.requestId, { status: "Yüklendi", documentId: firstId });
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

export function DocRequestForm({ open, onOpenChange, record, preset }: FormProps<DocumentRequest>) {
  const { save } = useErp();
  const o = useOptions();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Belge talebini düzenle" : "Müvekkilden belge iste"}
      description="Talep müvekkil portalında görünür; müvekkil belgeyi doğrudan yükleyebilir."
      fields={[
        {
          name: "clientId",
          label: "Müvekkil",
          type: "combobox",
          options: o.allClients,
          required: true,
        },
        { name: "caseId", label: "Dosya", type: "combobox", options: o.cases, allowClear: true },
        {
          name: "title",
          label: "İstenen belge",
          required: true,
          span: 2,
          placeholder: "Örn. Fatura suretleri",
        },
        { name: "dueDate", label: "Son tarih", type: "date" },
        {
          name: "status",
          label: "Durum",
          type: "select",
          options: ["Bekliyor", "Yüklendi", "Kapatıldı"],
          visible: () => !!record,
        },
        { name: "note", label: "Açıklama", type: "textarea" },
      ]}
      initial={{ dueDate: addDays(today(), 7), status: "Bekliyor", ...preset, ...record }}
      onSubmit={(v) => {
        save("docRequests", {
          id: record?.id,
          clientId: v.clientId,
          caseId: v.caseId || undefined,
          title: v.title.trim(),
          dueDate: v.dueDate || undefined,
          note: v.note || undefined,
          status: v.status ?? "Bekliyor",
          documentId: record?.documentId,
        });
        toast.success("Belge talebi oluşturuldu");
      }}
    />
  );
}
