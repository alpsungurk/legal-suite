import { toast } from "sonner";
import { FormDialog, type FormField } from "@/components/app/FormDialog";
import { useErp } from "@/lib/erp-store";
import { useOptions } from "@/lib/options";
import { CASE_STATUSES, USER_ROLES, type CaseFile, type Client, type User } from "@/lib/erp-types";
import { today } from "@/lib/format";
import { createPasswordRecord, passwordProblem } from "@/lib/auth";

export type FormProps<T> = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  record?: T;
  preset?: Partial<T>;
  onSaved?: (item: T) => void;
};

/* ───────────── Müvekkil ───────────── */

export function ClientForm({ open, onOpenChange, record, preset, onSaved }: FormProps<Client>) {
  const { save } = useErp();
  const corporate = (v: Record<string, unknown>) => v.kind === "Kurumsal";
  const fields: FormField[] = [
    { name: "kind", label: "Müvekkil türü", type: "segmented", options: ["Bireysel", "Kurumsal"] },
    {
      name: "name",
      label: "Ad soyad / Ünvan",
      required: true,
      span: 2,
      autoFocus: !record,
      placeholder: "Örn. Ayşe Demir",
    },
    { name: "phone", label: "Telefon", type: "tel", required: true, placeholder: "05xx xxx xx xx" },
    { name: "email", label: "E-posta", type: "email", placeholder: "ornek@email.com" },
    { name: "identity", label: "TC kimlik / Vergi no" },
    { name: "taxOffice", label: "Vergi dairesi", visible: corporate },
    { name: "address", label: "Adres", type: "textarea", placeholder: "Açık adres" },
    {
      name: "monthlyFee",
      label: "Aylık sabit ücret",
      type: "money",
      visible: corporate,
      section: "Finans",
      hint: "Her ay otomatik tahakkuk edilebilir",
    },
    {
      name: "monthlyFeeStartDate",
      label: "Ücret başlangıcı",
      type: "date",
      visible: (v) => corporate(v) && Number(v.monthlyFee) > 0,
    },
    {
      name: "advanceThreshold",
      label: "Avans uyarı limiti",
      type: "money",
      hint: "Masraf avansı bu tutarın altına düşünce uyarı verilir",
    },
    { name: "status", label: "Durum", type: "select", options: ["Aktif", "Pasif"] },
    {
      name: "portalEnabled",
      label: "Müvekkil portalı",
      type: "switch",
      hint: "Müvekkil kendi dosyalarını, duruşmalarını ve belgelerini görebilir",
    },
    {
      name: "portalShowStatement",
      label: "Portalda cari ekstre gösterilsin",
      type: "switch",
      visible: (v) => !!v.portalEnabled,
    },
    { name: "notes", label: "Notlar", type: "textarea" },
  ];
  const initial = {
    kind: "Bireysel",
    status: "Aktif",
    portalEnabled: false,
    portalShowStatement: true,
    advanceThreshold: 0,
    ...preset,
    ...record,
  };
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Müvekkili düzenle" : "Yeni müvekkil"}
      description="İletişim, finans ve portal ayarları"
      fields={fields}
      initial={initial}
      onSubmit={(v) => {
        const isCorp = v.kind === "Kurumsal";
        const item = save("clients", {
          id: record?.id,
          name: v.name.trim(),
          kind: v.kind,
          phone: v.phone ?? "",
          email: v.email ?? "",
          identity: v.identity || undefined,
          taxOffice: isCorp ? v.taxOffice || undefined : undefined,
          address: v.address || undefined,
          monthlyFee: isCorp && Number(v.monthlyFee) > 0 ? Number(v.monthlyFee) : undefined,
          monthlyFeeStartDate:
            isCorp && Number(v.monthlyFee) > 0 ? v.monthlyFeeStartDate || today() : undefined,
          advanceThreshold: Number(v.advanceThreshold) || 0,
          status: v.status,
          portalEnabled: !!v.portalEnabled,
          portalShowStatement: !!v.portalShowStatement,
          notes: v.notes || undefined,
        });
        toast.success(record ? "Müvekkil güncellendi" : "Müvekkil eklendi");
        onSaved?.(item);
      }}
    />
  );
}

/* ───────────── Dosya ───────────── */

function nextCaseNo(cases: CaseFile[]) {
  const year = new Date().getFullYear();
  const nums = cases
    .map((c) => c.no.match(new RegExp(`^${year}/(\\d+)`))?.[1])
    .filter(Boolean)
    .map(Number);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${year}/${String(n).padStart(3, "0")}`;
}

export function CaseForm({ open, onOpenChange, record, preset, onSaved }: FormProps<CaseFile>) {
  const { save, state, currentUser } = useErp();
  const o = useOptions();
  const fields: FormField[] = [
    { name: "no", label: "Büro dosya no", required: true },
    { name: "type", label: "Dosya türü", type: "select", options: o.caseTypes, required: true },
    {
      name: "title",
      label: "Dosya konusu",
      required: true,
      span: 2,
      autoFocus: !record,
      placeholder: "Örn. Alacak davası",
    },
    {
      name: "clientId",
      label: "Müvekkil",
      type: "combobox",
      options: o.allClients,
      required: true,
      placeholder: "Müvekkil seçin",
    },
    { name: "status", label: "Durum", type: "select", options: [...CASE_STATUSES] },
    { name: "court", label: "Mahkeme / Merci", placeholder: "Örn. İstanbul 3. Asliye Hukuk" },
    { name: "esasNo", label: "Esas no", placeholder: "Örn. 2026/412 E." },
    { name: "opposingParty", label: "Karşı taraf", span: 2 },
    {
      name: "responsibleIds",
      label: "Sorumlu avukatlar",
      type: "multiselect",
      options: o.lawyers,
      span: 2,
    },
    { name: "openingDate", label: "Açılış tarihi", type: "date", required: true },
    {
      name: "closingDate",
      label: "Kapanış tarihi",
      type: "date",
      visible: (v) => v.status === "Kapalı",
    },
    {
      name: "agreedFee",
      label: "Anlaşılan vekalet ücreti",
      type: "money",
      hint: "Bilgi amaçlı; tahsilat planını ayrıca oluşturun",
    },
    { name: "portalVisible", label: "Müvekkil portalında göster", type: "switch" },
    { name: "note", label: "Not", type: "textarea" },
  ];
  const initial = {
    no: nextCaseNo(state.cases),
    type: o.caseTypes[0],
    status: "Açık",
    responsibleIds: currentUser.role === "Avukat" ? [currentUser.id] : [],
    openingDate: today(),
    portalVisible: true,
    ...preset,
    ...record,
  };
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Dosyayı düzenle" : "Yeni dosya"}
      fields={fields}
      initial={initial}
      wide
      validate={(v) =>
        state.cases.some((c) => c.no === v.no.trim() && c.id !== record?.id)
          ? { no: "Bu dosya numarası kullanılıyor" }
          : undefined
      }
      onSubmit={(v) => {
        const prevResp = new Set(record?.responsibleIds ?? []);
        const added = (v.responsibleIds as string[]).filter((id) => !prevResp.has(id));
        const item = save(
          "cases",
          {
            id: record?.id,
            no: v.no.trim(),
            title: v.title.trim(),
            type: v.type,
            clientId: v.clientId || undefined,
            status: v.status,
            court: v.court || undefined,
            esasNo: v.esasNo || undefined,
            opposingParty: v.opposingParty || undefined,
            responsibleIds: v.responsibleIds ?? [],
            openingDate: v.openingDate,
            closingDate: v.status === "Kapalı" ? v.closingDate || today() : undefined,
            agreedFee: Number(v.agreedFee) || undefined,
            portalVisible: !!v.portalVisible,
            note: v.note || undefined,
          },
          added.length
            ? {
                notify: {
                  userIds: added,
                  title: "Size yeni dosya atandı",
                  link: record ? `/dosyalar/${record.id}` : undefined,
                },
              }
            : undefined,
        );
        toast.success(record ? "Dosya güncellendi" : "Dosya oluşturuldu");
        onSaved?.(item);
      }}
    />
  );
}

/* ───────────── Kullanıcı ───────────── */

export function UserForm({ open, onOpenChange, record, preset, onSaved }: FormProps<User>) {
  const { save, state } = useErp();
  const o = useOptions();
  const fields: FormField[] = [
    { name: "name", label: "Ad soyad", required: true, span: 2, autoFocus: !record },
    { name: "role", label: "Rol", type: "select", options: [...USER_ROLES], required: true },
    {
      name: "clientId",
      label: "Bağlı müvekkil",
      type: "combobox",
      options: o.allClients,
      required: true,
      visible: (v) => v.role === "Müvekkil",
    },
    {
      name: "title",
      label: "Ünvan",
      placeholder: "Örn. Avukat",
      visible: (v) => v.role !== "Müvekkil",
    },
    { name: "username", label: "Kullanıcı adı", required: true },
    { name: "email", label: "E-posta", type: "email", required: true },
    { name: "phone", label: "Telefon", type: "tel" },
    {
      name: "password",
      label: record ? "Yeni şifre (opsiyonel)" : "Şifre",
      type: "text",
      required: !record,
      hint: "En az 6 karakter",
    },
    { name: "active", label: "Hesap aktif", type: "switch" },
  ];
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Kullanıcıyı düzenle" : "Yeni kullanıcı"}
      fields={fields}
      initial={{ role: "Avukat", active: true, ...preset, ...record, password: "" }}
      validate={(v) => {
        const errs: Record<string, string> = {};
        const uname = String(v.username ?? "")
          .trim()
          .toLocaleLowerCase("tr");
        if (
          state.users.some(
            (u) => u.username.toLocaleLowerCase("tr") === uname && u.id !== record?.id,
          )
        ) {
          errs.username = "Bu kullanıcı adı alınmış";
        }
        if (v.password) {
          const p = passwordProblem(v.password);
          if (p) errs.password = p;
        }
        return errs;
      }}
      onSubmit={async (v) => {
        const pw = v.password ? await createPasswordRecord(v.password) : undefined;
        const item = save("users", {
          id: record?.id,
          name: v.name.trim(),
          role: v.role,
          clientId: v.role === "Müvekkil" ? v.clientId : undefined,
          title: v.role === "Müvekkil" ? undefined : v.title || undefined,
          username: v.username.trim().toLocaleLowerCase("tr"),
          email: v.email.trim(),
          phone: v.phone || undefined,
          active: !!v.active,
          passwordHash: pw?.passwordHash ?? record?.passwordHash ?? "",
          passwordSalt: pw?.passwordSalt ?? record?.passwordSalt ?? "",
        });
        toast.success(record ? "Kullanıcı güncellendi" : "Kullanıcı oluşturuldu");
        onSaved?.(item);
      }}
    />
  );
}
