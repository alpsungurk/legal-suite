/**
 * Lex Yönetim veri modeli.
 *
 * Tüm kayıtlar `firmId` taşır: bugün tek büro var, ileride çok büroya (ve Supabase'e)
 * geçildiğinde aynı şema satır bazlı yetkiyle kullanılabilir.
 */

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string;

export type BaseEntity = {
  id: string;
  firmId: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

/* ───────────────────────── Kullanıcılar ───────────────────────── */

export const USER_ROLES = ["Admin", "Avukat", "Sekreter", "Müvekkil"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type User = BaseEntity & {
  name: string;
  role: UserRole;
  email: string;
  username: string;
  phone?: string;
  title?: string;
  active: boolean;
  passwordHash: string;
  passwordSalt: string;
  /** Müvekkil rolündeki kullanıcının bağlı olduğu müvekkil */
  clientId?: string;
};

/* ───────────────────────── Müvekkil & Dosya ───────────────────────── */

export type ClientKind = "Bireysel" | "Kurumsal";

export type Client = BaseEntity & {
  name: string;
  kind: ClientKind;
  email: string;
  phone: string;
  status: "Aktif" | "Pasif";
  identity?: string;
  taxOffice?: string;
  address?: string;
  notes?: string;
  /** Kurumsal müvekkiller için aylık sabit ücret */
  monthlyFee?: number;
  monthlyFeeStartDate?: ISODate;
  /** Avans bakiyesi bu tutarın altına düşünce uyarı */
  advanceThreshold?: number;
  portalEnabled: boolean;
  portalShowStatement: boolean;
};

export const CASE_STATUSES = ["Açık", "Derdest", "Karar", "Kanun yolu", "Kapalı"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export type CaseFile = BaseEntity & {
  no: string;
  title: string;
  clientId?: string;
  court?: string;
  esasNo?: string;
  type: string;
  status: CaseStatus;
  responsibleIds: string[];
  opposingParty?: string;
  openingDate: ISODate;
  closingDate?: ISODate;
  /** Anlaşılan vekalet ücreti (bilgi amaçlı) */
  agreedFee?: number;
  note?: string;
  portalVisible: boolean;
};

/* ───────────────────────── Ekler ───────────────────────── */

export type AttachmentRef = {
  id: string;
  name: string;
  mime: string;
  size: number;
};

/* ───────────────────────── Finans ───────────────────────── */

export const PAYMENT_METHODS = ["Nakit", "Havale/EFT", "Kredi kartı", "Çek", "Diğer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Masraf: dosyaya/müvekkile ya da büroya ait gider. */
export type Expense = BaseEntity & {
  title: string;
  type: string;
  amount: number;
  date: ISODate;
  caseId?: string;
  clientId?: string;
  /** Müvekkil: avanstan düşer / müvekkile yansıtılır. Büro: büro gideri. */
  chargeTo: "Müvekkil" | "Büro";
  /** Parayı kim ödedi. Müvekkil kendi ödediyse büro kasasından çıkış olmaz. */
  paidBy: "Büro" | "Müvekkil";
  accountId?: string;
  receipts: AttachmentRef[];
  note?: string;
  createdBy: string;
};

/** Masraf avansı: müvekkilden masraflar için alınan para (veya iadesi). */
export type Advance = BaseEntity & {
  kind: "Avans" | "İade";
  clientId: string;
  caseId?: string;
  amount: number;
  date: ISODate;
  method: PaymentMethod;
  accountId?: string;
  note?: string;
};

export type InstallmentPayment = {
  id: string;
  date: ISODate;
  amount: number;
  method: PaymentMethod;
  accountId?: string;
  note?: string;
};

export type Installment = {
  id: string;
  dueDate: ISODate;
  amount: number;
  payments: InstallmentPayment[];
};

export const FEE_KINDS = [
  "Vekalet ücreti",
  "Aylık ücret",
  "Danışmanlık",
  "Karşı vekalet ücreti",
  "Diğer",
] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

/** Tahsilat planı: müvekkilden alınacak ücret ve taksitleri. */
export type FeePlan = BaseEntity & {
  title: string;
  kind: FeeKind;
  clientId: string;
  caseId?: string;
  date: ISODate;
  total: number;
  installments: Installment[];
  /** Aylık ücret tahakkukunda dönem (YYYY-MM) */
  period?: string;
  cancelled: boolean;
  note?: string;
};

export type Account = BaseEntity & {
  name: string;
  type: "Kasa" | "Banka";
  bankName?: string;
  iban?: string;
  openingBalance: number;
  openingDate: ISODate;
  active: boolean;
};

/** Banka/kasa üzerinde elle girilen hareket (virman, diğer gelir/gider). */
export type AccountTx = BaseEntity & {
  accountId: string;
  date: ISODate;
  /** Pozitif: giriş, negatif: çıkış */
  amount: number;
  category: "Virman" | "Diğer gelir" | "Diğer gider" | "Müvekkile aktarım";
  description: string;
  transferId?: string;
  clientId?: string;
};

/* ───────────────────────── Ajanda ───────────────────────── */

export type Reminder = BaseEntity & {
  title: string;
  type: string;
  date: ISODate;
  time?: string;
  location?: string;
  caseId?: string;
  clientId?: string;
  enforcementId?: string;
  assigneeId: string;
  status: "Bekliyor" | "Tamamlandı" | "İptal";
  note?: string;
  portalVisible: boolean;
};

/* ───────────────────────── İcra ───────────────────────── */

export type Debtor = BaseEntity & {
  name: string;
  kind: ClientKind;
  identity?: string;
  phone?: string;
  email?: string;
  address?: string;
  assets?: string;
  notes?: string;
};

export const ENFORCEMENT_STATUSES = [
  "Derdest",
  "Haciz",
  "Satış",
  "Ödeme planı",
  "Tahsil edildi",
  "Kapandı",
] as const;
export type EnforcementStatus = (typeof ENFORCEMENT_STATUSES)[number];

export const ENFORCEMENT_TYPES = [
  "İlamsız",
  "İlamlı",
  "Kambiyo",
  "Rehin",
  "Kira",
  "Diğer",
] as const;

export type EnforcementFile = BaseEntity & {
  no: string;
  office: string;
  type: string;
  clientId: string;
  debtorIds: string[];
  principal: number;
  interest: number;
  costs: number;
  status: EnforcementStatus;
  openingDate: ISODate;
  responsibleIds: string[];
  caseId?: string;
  note?: string;
};

export type PaymentPromise = BaseEntity & {
  enforcementId: string;
  debtorId: string;
  amount: number;
  dueDate: ISODate;
  status: "Bekliyor" | "Tutuldu" | "Tutulmadı" | "İptal";
  note?: string;
};

export type Collection = BaseEntity & {
  enforcementId: string;
  debtorId: string;
  amount: number;
  date: ISODate;
  method: PaymentMethod;
  accountId?: string;
  promiseId?: string;
  transferredToClient: boolean;
  note?: string;
};

export const CONTACT_CHANNELS = ["Telefon", "WhatsApp", "Yüz yüze", "E-posta", "Tebligat"] as const;

export type ContactLog = BaseEntity & {
  debtorId: string;
  enforcementId?: string;
  date: ISODate;
  channel: string;
  note: string;
  userId: string;
};

/* ───────────────────────── Belgeler & Portal ───────────────────────── */

export type DocumentFile = BaseEntity & {
  name: string;
  category: string;
  attachment: AttachmentRef;
  caseId?: string;
  clientId?: string;
  enforcementId?: string;
  uploadedBy: string;
  visibleToClient: boolean;
  requestId?: string;
};

export type DocumentRequest = BaseEntity & {
  clientId: string;
  caseId?: string;
  title: string;
  note?: string;
  dueDate?: ISODate;
  status: "Bekliyor" | "Yüklendi" | "Kapatıldı";
  documentId?: string;
};

export type Message = BaseEntity & {
  clientId: string;
  authorId: string;
  body: string;
  readByFirm: boolean;
  readByClient: boolean;
};

/* ───────────────────────── Sistem ───────────────────────── */

export type AppNotification = BaseEntity & {
  userId: string;
  title: string;
  detail: string;
  type: string;
  read: boolean;
  link?: string;
};

export type FieldChange = { field: string; before: string; after: string };

export type ActivityLog = BaseEntity & {
  actorId: string;
  action: "Ekleme" | "Güncelleme" | "Silme" | "İşlem";
  entity: string;
  entityId?: string;
  detail: string;
  changes?: FieldChange[];
};

export type FirmProfile = {
  name: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  taxOffice: string;
  taxNo: string;
  bankName: string;
  iban: string;
  logo?: AttachmentRef;
  statementNote: string;
};

export type Settings = {
  firm: FirmProfile;
  caseTypes: string[];
  expenseTypes: string[];
  reminderTypes: string[];
  documentCategories: string[];
};

export type Collections = {
  users: User;
  clients: Client;
  cases: CaseFile;
  expenses: Expense;
  advances: Advance;
  plans: FeePlan;
  accounts: Account;
  transactions: AccountTx;
  reminders: Reminder;
  debtors: Debtor;
  enforcements: EnforcementFile;
  promises: PaymentPromise;
  collections: Collection;
  contacts: ContactLog;
  documents: DocumentFile;
  docRequests: DocumentRequest;
  messages: Message;
  notifications: AppNotification;
  activities: ActivityLog;
};

export type CollectionKey = keyof Collections;

export type ErpState = { version: number; firmId: string; settings: Settings } & {
  [K in CollectionKey]: Collections[K][];
};

export const STATE_VERSION = 3;

export const DEFAULT_CASE_TYPES = ["Dava", "İcra", "Danışmanlık", "Arabuluculuk", "Ceza"];
export const DEFAULT_EXPENSE_TYPES = [
  "Harç",
  "Bilirkişi",
  "Tebligat",
  "Keşif",
  "Yol",
  "Kargo",
  "Noter",
  "Fotokopi",
  "Ofis gideri",
  "Diğer",
];
export const DEFAULT_REMINDER_TYPES = [
  "Duruşma",
  "Keşif",
  "Evrak teslimi",
  "Süre sonu",
  "Müvekkili ara",
  "Toplantı",
  "Diğer",
];
export const DEFAULT_DOCUMENT_CATEGORIES = [
  "Dilekçe",
  "Karar",
  "Tutanak",
  "Vekaletname",
  "Sözleşme",
  "Makbuz",
  "Kimlik",
  "Diğer",
];

/* ───────────────────────── Yetkiler ───────────────────────── */

export function permissionsFor(role: UserRole) {
  const admin = role === "Admin";
  const secretary = role === "Sekreter";
  const lawyer = role === "Avukat";
  const staff = admin || secretary || lawyer;
  return {
    isStaff: staff,
    isPortal: role === "Müvekkil",
    manageUsers: admin,
    manageSettings: admin || secretary,
    viewFinance: admin || secretary,
    manageFinance: admin || secretary,
    addExpense: staff,
    manageRecords: staff,
    deleteRecords: admin || secretary,
    viewActivity: admin,
    viewReports: admin || secretary,
  };
}

export type Permissions = ReturnType<typeof permissionsFor>;
