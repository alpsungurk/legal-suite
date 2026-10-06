import type { ManagementFormField } from "@/components/management/ManagementEditorDialog";

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
      name: "monthlyFee",
      label: "Aylık ücret",
      type: "number",
      placeholder: "0",
      visibleWhen: { field: "kind", equals: "Kurumsal" },
    },
    {
      name: "monthlyFeeStartDate",
      label: "Aylık ücret başlangıç tarihi",
      type: "date",
      visibleWhen: { field: "kind", equals: "Kurumsal" },
    },
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
      allowEmpty: true,
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
    { name: "openingDate", label: "Açılış tarihi", type: "date", required: true },
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
      placeholder: "Örn. Yasal vekalet ücreti",
      required: true,
      fullWidth: true,
    },
    {
      name: "caseLabel",
      label: "Dosya (opsiyonel)",
      type: "select",
      options: opts.caseOptions,
      allowEmpty: true,
    },
    { name: "date", label: "Tarih", type: "date", required: true },
    {
      name: "clientName",
      label: "Müvekkil",
      type: "select",
      options: opts.clientOptions,
      required: true,
    },
    {
      name: "direction",
      label: "Gelen / Giden",
      type: "select",
      options: ["Gelen", "Giden"],
      required: true,
    },
    {
      name: "recordDate",
      label: "Alacak olarak kaydetme tarihi",
      type: "date",
      required: true,
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
      options: ["Alındı", "Belgelendi", "Onay bekliyor", "Belgesiz"],
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
      allowEmpty: true,
      fullWidth: true,
    },
    {
      name: "caseLabel",
      label: "Dosya (opsiyonel)",
      type: "select",
      options: opts.caseOptions,
      allowEmpty: true,
    },
    { name: "date", label: "Parayı alma tarihi", type: "date", required: true },
    { name: "amount", label: "Tahsilat tutarı", type: "number", placeholder: "0", required: true },
    {
      name: "type",
      label: "Ödeme türü",
      type: "select",
      options: ["Peşin", "Nakit", "Havale"],
      required: true,
    },
    {
      name: "taksitPlan",
      label: "Taksit planı",
      type: "select",
      options: ["Tek ödeme", "2 taksit", "3 taksit", "6 taksit", "12 taksit"],
      required: true,
    },
    {
      name: "feePeriod",
      label: "Aylık ücret dönemi (kurumsal müvekkilde zorunlu)",
      type: "month",
      placeholder: "YYYY-AA",
    },
    {
      name: "description",
      label: "Açıklama",
      type: "select",
      options: ["Yasal vekalet ücreti"],
      required: true,
      fullWidth: true,
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
      options: ["Admin", "Avukat", "Sekreter"],
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
  expenseTypes: [
    "Harç",
    "Bilirkişi",
    "Tebligat",
    "Yol",
    "Kargo",
    "Fotokopi",
    "Ofis gideri",
    "Diğer",
  ],
});
export const paymentFormFields = buildPaymentFormFields({
  clientOptions: [],
  caseOptions: [],
});
