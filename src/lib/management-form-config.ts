import type { ManagementFormField } from "@/components/management/ManagementEditorDialog";
import { caseOptions, clientOptions, lawyerOptions } from "@/lib/erp-data";

export const clientFormFields: ManagementFormField[] = [
  {
    name: "title",
    label: "Ad Soyad / Firma",
    placeholder: "Örn. Ayşe Demir",
    required: true,
    fullWidth: true,
  },
  { name: "subtitle", label: "E-posta adresi", placeholder: "ornek@email.com", required: true },
  { name: "meta", label: "Telefon", placeholder: "05xx xxx xx xx", required: true },
  { name: "clientType", label: "Müvekkil türü", type: "select", options: ["Bireysel", "Kurumsal"] },
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
    options: ["Aktif", "İncelemede", "Pasif"],
    required: true,
  },
];

export const caseFormFields: ManagementFormField[] = [
  {
    name: "title",
    label: "Dosya No ve Dosya Adı",
    placeholder: "2026/129 • Dava adı",
    required: true,
    fullWidth: true,
  },
  { name: "subtitle", label: "Müvekkil", type: "select", options: clientOptions, required: true },
  {
    name: "meta",
    label: "Mahkeme",
    placeholder: "Örn. İstanbul 3. Asliye Hukuk",
    required: true,
  },
  {
    name: "caseType",
    label: "Dosya türü",
    type: "select",
    options: ["Dava", "İcra", "Danışmanlık", "Arabuluculuk"],
  },
  { name: "responsible", label: "Sorumlu avukat", type: "select", options: lawyerOptions },
  { name: "openingDate", label: "Açılış tarihi", type: "date" },
  {
    name: "status",
    label: "Dosya aşaması",
    type: "select",
    options: ["Tebligat", "Ön inceleme", "Delil toplama", "Duruşma", "Kapalı"],
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

export const expenseFormFields: ManagementFormField[] = [
  {
    name: "title",
    label: "Masraf açıklaması",
    placeholder: "Örn. Harç ödemesi",
    required: true,
    fullWidth: true,
  },
  { name: "subtitle", label: "Dosya", type: "select", options: caseOptions, required: true },
  { name: "meta", label: "Tarih", type: "date", required: true },
  { name: "client", label: "Müvekkil", type: "select", options: clientOptions },
  {
    name: "payer",
    label: "Ödeyen kişi",
    type: "select",
    options: ["Büro", "Müvekkil", "Karşı taraf"],
  },
  { name: "amount", label: "Tutar", type: "number", placeholder: "0", required: true },
  {
    name: "expenseType",
    label: "Masraf türü",
    type: "select",
    options: ["Harç", "Bilirkişi", "Tebligat", "Yol", "Kargo", "Fotokopi", "Ofis gideri", "Diğer"],
  },
  {
    name: "status",
    label: "Belge durumu",
    type: "select",
    options: ["Belgelendi", "Onay bekliyor", "Belgesiz"],
    required: true,
  },
];

export const paymentFormFields: ManagementFormField[] = [
  {
    name: "title",
    label: "Müvekkil",
    type: "select",
    options: clientOptions,
    required: true,
    fullWidth: true,
  },
  { name: "subtitle", label: "Dosya", type: "select", options: caseOptions, required: true },
  { name: "meta", label: "Tahsilat tarihi", type: "date", required: true },
  { name: "amount", label: "Tahsilat tutarı", type: "number", placeholder: "0", required: true },
  {
    name: "paymentType",
    label: "Ödeme türü",
    type: "select",
    options: ["Nakit", "Havale", "EFT", "Kredi Kartı", "Diğer"],
  },
  {
    name: "status",
    label: "Tahsilat durumu",
    type: "select",
    options: ["Tamamlandı", "Beklemede", "İptal"],
    required: true,
  },
];

export const documentFormFields: ManagementFormField[] = [
  {
    name: "title",
    label: "Evrak adı",
    placeholder: "Örn. Dava Dilekçesi.pdf",
    required: true,
    fullWidth: true,
  },
  { name: "subtitle", label: "Bağlı dosya", type: "select", options: caseOptions, required: true },
  { name: "meta", label: "Yükleme tarihi", type: "date", required: true },
  { name: "client", label: "Müvekkil", type: "select", options: clientOptions },
  {
    name: "documentType",
    label: "Belge türü",
    type: "select",
    options: ["PDF", "JPG", "PNG", "DOCX", "XLSX"],
  },
  { name: "file", label: "Belge yükle", type: "file" },
  {
    name: "status",
    label: "Evrak durumu",
    type: "select",
    options: ["Taslak", "İnceleniyor", "İmzalandı", "Arşivlendi"],
    required: true,
  },
];
