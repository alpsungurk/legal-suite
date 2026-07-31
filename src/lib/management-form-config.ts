import type { ManagementFormField } from "@/components/management/ManagementEditorDialog";
import { CASE_STAGES } from "@/lib/erp-types";

export function buildClientFormFields(): ManagementFormField[] {
  return [
    {
      name: "name",
      label: "Ad Soyad / Firma",
      placeholder: "Örn. Ayşe Demir",
      required: true,
      fullWidth: true,
    },
    { name: "email", label: "E-posta adresi", placeholder: "ornek@email.com", required: true },
    { name: "phone", label: "Telefon", placeholder: "05xx xxx xx xx", required: true },
    {
      name: "kind",
      label: "Müvekkil türü",
      type: "select",
      options: ["Bireysel", "Kurumsal"],
      required: true,
    },
    { name: "identity", label: "TC Kimlik / Vergi No", placeholder: "Opsiyonel" },
    {
      name: "address",
      label: "Adres",
      type: "textarea",
      placeholder: "Açık adres bilgisi",
      fullWidth: true,
    },
    {
      name: "status",
      label: "Kayıt durumu",
      type: "select",
      options: ["Aktif", "Pasif"],
      required: true,
    },
  ];
}

export function buildCaseFormFields(opts: {
  clientOptions: string[];
  lawyerOptions: string[];
  caseTypes: string[];
}): ManagementFormField[] {
  return [
    {
      name: "no",
      label: "Dosya No",
      placeholder: "Örn. 2026/129",
      required: true,
    },
    {
      name: "title",
      label: "Dosya Adı",
      placeholder: "Örn. Alacak davası",
      required: true,
    },
    {
      name: "clientName",
      label: "Müvekkil",
      type: "select",
      options: opts.clientOptions,
      required: true,
    },
    {
      name: "court",
      label: "Mahkeme",
      placeholder: "Örn. İstanbul 3. Asliye Hukuk",
      required: true,
    },
    {
      name: "type",
      label: "Dosya türü",
      type: "select",
      options: opts.caseTypes,
      required: true,
    },
    {
      name: "responsibleName",
      label: "Sorumlu avukat",
      type: "select",
      options: opts.lawyerOptions,
      required: true,
    },
    { name: "openingDate", label: "Açılış tarihi", type: "date", required: true },
    {
      name: "stage",
      label: "Dosya aşaması",
      type: "select",
      options: [...CASE_STAGES],
      required: true,
    },
    {
      name: "note",
      label: "Dosya açıklaması",
      type: "textarea",
      placeholder: "Kısa dosya notu",
      fullWidth: true,
    },
  ];
}

export function buildExpenseFormFields(opts: {
  caseOptions: string[];
  clientOptions: string[];
  expenseTypes: string[];
}): ManagementFormField[] {
  return [
    {
      name: "title",
      label: "Masraf açıklaması",
      placeholder: "Örn. Harç ödemesi",
      required: true,
      fullWidth: true,
    },
    {
      name: "caseLabel",
      label: "Dosya",
      type: "select",
      options: opts.caseOptions,
      required: true,
    },
    { name: "date", label: "Tarih", type: "date", required: true },
    {
      name: "clientName",
      label: "Müvekkil",
      type: "select",
      options: opts.clientOptions,
    },
    {
      name: "payer",
      label: "Ödeyen kişi",
      type: "select",
      options: ["Büro", "Müvekkil", "Karşı taraf"],
    },
    { name: "amount", label: "Tutar", type: "number", placeholder: "0", required: true },
    {
      name: "type",
      label: "Masraf türü",
      type: "select",
      options: opts.expenseTypes,
      required: true,
    },
    {
      name: "status",
      label: "Belge durumu",
      type: "select",
      options: ["Belgelendi", "Onay bekliyor", "Belgesiz"],
      required: true,
    },
  ];
}

export function buildPaymentFormFields(opts: {
  clientOptions: string[];
  caseOptions: string[];
}): ManagementFormField[] {
  return [
    {
      name: "clientName",
      label: "Müvekkil",
      type: "select",
      options: opts.clientOptions,
      required: true,
      fullWidth: true,
    },
    {
      name: "caseLabel",
      label: "Dosya",
      type: "select",
      options: opts.caseOptions,
      required: true,
    },
    { name: "date", label: "Tahsilat tarihi", type: "date", required: true },
    { name: "amount", label: "Tahsilat tutarı", type: "number", placeholder: "0", required: true },
    {
      name: "type",
      label: "Ödeme türü",
      type: "select",
      options: ["Nakit", "Havale", "EFT", "Kredi Kartı", "Diğer"],
    },
    {
      name: "description",
      label: "Açıklama",
      placeholder: "Örn. Vekalet ücreti",
      required: true,
    },
    {
      name: "status",
      label: "Tahsilat durumu",
      type: "select",
      options: ["Tamamlandı", "Beklemede", "İptal"],
      required: true,
    },
  ];
}

export function buildReminderFormFields(opts: {
  caseOptions: string[];
  clientOptions: string[];
  userOptions: string[];
  reminderTypes: string[];
}): ManagementFormField[] {
  return [
    {
      name: "title",
      label: "Hatırlatma başlığı",
      placeholder: "Örn. Duruşma – 2026/128",
      required: true,
      fullWidth: true,
    },
    {
      name: "caseLabel",
      label: "İlgili dosya",
      type: "select",
      options: opts.caseOptions,
      required: true,
    },
    { name: "date", label: "Hatırlatma tarihi", type: "date", required: true },
    {
      name: "clientName",
      label: "Müvekkil",
      type: "select",
      options: opts.clientOptions,
    },
    {
      name: "assigneeName",
      label: "Atanan kişi",
      type: "select",
      options: opts.userOptions,
      required: true,
    },
    {
      name: "type",
      label: "Hatırlatma türü",
      type: "select",
      options: opts.reminderTypes,
      required: true,
    },
    {
      name: "status",
      label: "Hatırlatma durumu",
      type: "select",
      options: ["Beklemede", "Tamamlandı"],
      required: true,
    },
    {
      name: "note",
      label: "Not",
      type: "textarea",
      placeholder: "Hatırlatma notu",
      fullWidth: true,
    },
  ];
}

export function buildUserFormFields(): ManagementFormField[] {
  return [
    {
      name: "name",
      label: "Ad Soyad",
      placeholder: "Örn. Av. Ahmet Yılmaz",
      required: true,
      fullWidth: true,
    },
    {
      name: "username",
      label: "Kullanıcı adı",
      placeholder: "Örn. avukat3",
      required: true,
    },
    {
      name: "email",
      label: "E-posta adresi",
      placeholder: "ornek@buro.com",
      required: true,
    },
    {
      name: "role",
      label: "Kullanıcı rolü",
      type: "select",
      options: ["Admin", "Avukat", "Sekreter", "Stajyer"],
      required: true,
    },
  ];
}

/** @deprecated Use build* helpers with store options */
export const clientFormFields = buildClientFormFields();
export const caseFormFields = buildCaseFormFields({
  clientOptions: [],
  lawyerOptions: [],
  caseTypes: ["Dava", "İcra", "Danışmanlık", "Arabuluculuk"],
});
export const expenseFormFields = buildExpenseFormFields({
  caseOptions: [],
  clientOptions: [],
  expenseTypes: ["Harç", "Bilirkişi", "Tebligat", "Yol", "Kargo", "Fotokopi", "Ofis gideri", "Diğer"],
});
export const paymentFormFields = buildPaymentFormFields({
  clientOptions: [],
  caseOptions: [],
});
