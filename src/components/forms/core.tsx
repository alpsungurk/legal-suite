import { toast } from "sonner";
import { FormDialog, type FormField } from "@/components/app/FormDialog";
import { useErp } from "@/lib/erp-store";
import { useOptions } from "@/lib/options";
import { USER_ROLES, type CaseFile, type Client, type User } from "@/lib/erp-types";
import { today } from "@/lib/format";
import { useCloseCase } from "@/components/forms/close-case";
import { passwordProblem } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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
    { name: "status", label: "Durum", type: "select", options: ["Aktif", "Pasif"] },
    { name: "notes", label: "Notlar", type: "textarea" },
  ];
  const initial = {
    kind: "Bireysel",
    status: "Aktif",
    ...preset,
    ...record,
  };
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Müvekkili düzenle" : "Yeni müvekkil"}
      description="İletişim ve finans bilgileri"
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
          status: v.status,
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
  const { save, state, currentUser, permissions, rememberOption } = useErp();
  const closeCase = useCloseCase();
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
    { name: "status", label: "Durum", type: "select", options: o.caseStatuses },
    {
      name: "court",
      label: "Mahkeme / Merci",
      type: "combobox",
      options: o.courts,
      creatable: true,
      allowClear: true,
      placeholder: "Listeden seçin veya yazın",
    },
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
    { name: "note", label: "Not", type: "textarea" },
  ];
  const initial = {
    no: nextCaseNo(state.cases),
    type: o.caseTypes[0],
    status: "Açık",
    responsibleIds: currentUser.role === "Avukat" ? [currentUser.id] : [],
    openingDate: today(),
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
      onSubmit={async (v) => {
        // Mevcut dosya "Kapalı" yapılırsa dosya silinir, müvekkilde yalnızca toplamlar kalır
        if (
          permissions.can("cases", "delete") &&
          record &&
          v.status === "Kapalı" &&
          record.status !== "Kapalı"
        ) {
          return closeCase(record.id);
        }
        rememberOption("courts", v.court);
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
  const { save, setUserPassword, isUsernameAvailable, reloadFromServer } = useErp();
  const fields: FormField[] = [
    { name: "name", label: "Ad soyad", required: true, span: 2, autoFocus: !record },
    { name: "role", label: "Rol", type: "select", options: [...USER_ROLES], required: true },
    {
      name: "title",
      label: "Ünvan",
      placeholder: "Örn. Avukat",
    },
    { name: "username", label: "Kullanıcı adı", required: true },
    { name: "email", label: "E-posta", type: "email", required: true },
    { name: "phone", label: "Telefon", type: "tel" },
    {
      name: "password",
      label: record ? "Yeni şifre (opsiyonel)" : "Geçici şifre (opsiyonel)",
      type: "text",
      required: false,
      hint: record
        ? "Doldurursanız şifre güncellenir (en az 8 karakter)"
        : "Boş bırakılırsa davet e-postası gider; doldurulursa geçici şifre atanır",
    },
    { name: "active", label: "Hesap aktif", type: "switch" },
  ];
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Kullanıcıyı düzenle" : "Kullanıcı davet et"}
      fields={fields}
      initial={{ role: "Avukat", active: true, ...preset, ...record, password: "" }}
      validate={(v) => {
        const errs: Record<string, string> = {};
        const uname = String(v.username ?? "")
          .trim()
          .toLocaleLowerCase("tr");
        if (!isUsernameAvailable(uname, record?.id)) {
          errs.username = "Bu kullanıcı adı alınmış";
        }
        if (v.password) {
          const p = passwordProblem(String(v.password));
          if (p) errs.password = p;
        }
        return errs;
      }}
      onSubmit={async (v) => {
        if (record) {
          const item = save("users", {
            id: record.id,
            name: v.name.trim(),
            role: v.role,
            title: v.title || undefined,
            username: v.username.trim().toLocaleLowerCase("tr"),
            email: v.email.trim(),
            phone: v.phone || undefined,
            active: !!v.active,
            passwordHash: "",
            passwordSalt: "",
            permissions: record.permissions,
          });
          if (v.password) {
            const r = await setUserPassword(record.id, String(v.password));
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
          }
          toast.success("Kullanıcı güncellendi");
          onSaved?.(item);
          return;
        }

        const { data, error } = await supabase.functions.invoke("invite-user", {
          body: {
            action: "invite",
            name: v.name.trim(),
            username: v.username.trim().toLocaleLowerCase("tr"),
            email: v.email.trim(),
            phone: v.phone || null,
            title: v.title || null,
            role: v.role === "Admin" ? "admin" : "avukat",
            password: v.password ? String(v.password) : null,
          },
        });
        if (error || data?.error) {
          toast.error(error?.message || String(data?.error) || "Davet başarısız");
          return;
        }
        await reloadFromServer();
        toast.success(
          v.password
            ? "Kullanıcı oluşturuldu"
            : "Davet e-postası gönderildi",
        );
        onSaved?.(data?.user as User);
      }}
    />
  );
}
