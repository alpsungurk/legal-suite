import { toast } from "sonner";
import { FormDialog, type FormField } from "@/components/app/FormDialog";
import { useErp } from "@/lib/erp-store";
import { useOptions } from "@/lib/options";
import { USER_ROLES, type CaseFile, type Client, type User } from "@/lib/erp-types";
import { today } from "@/lib/format";
import { useCloseConfirm } from "@/components/forms/close-case";
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
  const confirmClose = useCloseConfirm();
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
    {
      name: "feeStatus",
      label: "Vekalet ücreti durumu",
      type: "combobox",
      options: state.settings.caseFeeStatuses ?? [],
      creatable: true,
      allowClear: true,
      placeholder: "Alındı, icrada, istendi…",
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
        // Mevcut dosya "Kapalı" yapılırsa onay sorulur: dosya hemen silinmez, ayardaki süre
        // (varsayılan 12 ay) kapalı olarak saklanır, sonra ay başındaki iş siler
        if (
          record &&
          v.status === "Kapalı" &&
          record.status !== "Kapalı" &&
          !(await confirmClose(record.id))
        ) {
          return false;
        }
        rememberOption("courts", v.court);
        if (v.feeStatus) rememberOption("caseFeeStatuses", v.feeStatus);
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
            // Hiç girilmemişse gönderilmez; boşaltılırsa "" ile silinir
            feeStatus: v.feeStatus || record?.feeStatus ? (v.feeStatus ?? "") : undefined,
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
  const { save, isUsernameAvailable, reloadFromServer, permissions } = useErp();
  const fields: FormField[] = [
    { name: "name", label: "Ad soyad", required: true, span: 2, autoFocus: !record },
    {
      name: "role",
      label: "Rol",
      type: "select",
      // Yalnızca Admin, Admin rolü verebilir
      options: permissions.manageUsers ? [...USER_ROLES] : ["Avukat"],
      required: true,
    },
    {
      name: "title",
      label: "Ünvan",
      placeholder: "Örn. Avukat",
    },
    { name: "username", label: "Kullanıcı adı", required: true },
    // Giriş e-postası hesap kimliğidir; sonradan değiştirilirse giriş bozulur, bu yüzden yalnızca eklerken girilir
    ...(record
      ? []
      : ([
          {
            name: "email",
            label: "E-posta",
            type: "email",
            required: true,
            hint: "Giriş hesabı bu e-postayla oluşturulur; kullanıcı kullanıcı adı veya e-postasıyla giriş yapar",
          },
        ] as FormField[])),
    { name: "phone", label: "Telefon", type: "tel" },
    // Şifre yalnızca eklerken verilir; sonradan şifreyi kullanıcı kendi profilinden değiştirir
    ...(record
      ? []
      : ([
          {
            name: "password",
            label: "Geçici şifre",
            type: "text",
            required: true,
            hint: "En az 8 karakter. Kullanıcı ilk girişte kendi şifresini belirlemek zorundadır",
          },
        ] as FormField[])),
    { name: "active", label: "Hesap aktif", type: "switch" },
  ];
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Kullanıcıyı düzenle" : "Kullanıcı ekle"}
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
            email: record.email,
            phone: v.phone || undefined,
            active: !!v.active,
            passwordHash: "",
            passwordSalt: "",
            permissions: record.permissions,
          });
          toast.success("Kullanıcı güncellendi");
          onSaved?.(item);
          return;
        }

        const { data, error } = await supabase.functions.invoke("invite-user", {
          body: {
            action: "invite",
            name: v.name.trim(),
            username: v.username.trim().toLocaleLowerCase("tr"),
            email: String(v.email ?? "").trim(),
            phone: v.phone || null,
            title: v.title || null,
            role: v.role === "Admin" ? "admin" : "avukat",
            password: v.password ? String(v.password) : null,
          },
        });
        if (error || data?.error) {
          let msg = data?.error ? String(data.error) : "";
          // Fonksiyon 4xx/5xx döndüyse asıl mesaj yanıt gövdesindedir
          const res = (error as { context?: Response } | null)?.context;
          if (!msg && res && typeof res.json === "function") {
            try {
              msg = String((await res.json())?.error ?? "");
            } catch {
              /* yoksay */
            }
          }
          toast.error(
            msg || "Kullanıcı eklenemedi. Sunucu fonksiyonu (invite-user) yayında olmayabilir.",
          );
          return;
        }
        await reloadFromServer();
        toast.success("Kullanıcı oluşturuldu; ilk girişte şifresini kendisi belirleyecek");
        onSaved?.(data?.user as User);
      }}
    />
  );
}
