/**
 * LexKasa veri modeli.
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

export const USER_ROLES = ["Admin", "Avukat"] as const;
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
  /** Role göre varsayılan izinlere yapılan kişisel istisnalar ("modül.eylem": açık/kapalı) */
  permissions?: Record<string, boolean>;
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
  /** Kapatılıp silinen dosyalardan geriye kalan özet (sadece sayılar) */
  closedCases?: ClosedCasesSummary;
};

/** Kapanan dosyaların silindikten sonra müvekkilde kalan toplamları. */
export type ClosedCasesSummary = {
  caseCount: number;
  /** Toplam alacak: kapanan dosyalarda müvekkilin büroya kalan borcu (dosya bazında net) */
  receivable: number;
  /** Toplam verecek: kapanan dosyalarda büronun müvekkile kalan borcu (dosya bazında net) */
  payable: number;
  /** Kapanan dosyaların toplam ücreti / bunun tahsil edilen kısmı */
  feeTotal: number;
  feePaid: number;
  lastClosedAt: ISODateTime;
};

/** Varsayılan dosya durumları; Ayarlar > Kategoriler'den değiştirilebilir. */
export const CASE_STATUSES = ["Açık", "Derdest", "Karar", "Kanun yolu", "Kapalı"];
/** "Kapalı" dosya kapatmayı tetikler, "Açık" yeni dosyanın varsayılanıdır: silinemez */
export const LOCKED_CASE_STATUSES = ["Açık", "Kapalı"];
export type CaseStatus = string;

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
};

/* ───────────────────────── Ekler ───────────────────────── */

export type AttachmentRef = {
  id: string;
  name: string;
  mime: string;
  size: number;
};

/* ───────────────────────── Finans ───────────────────────── */

export const PAYMENT_METHODS = ["Nakit", "Havale/EFT", "Kredi kartı", "Çek", "Diğer"];
export type PaymentMethod = string;

/** Masraf: dosyaya/müvekkile ya da büroya ait gider. */
export type Expense = BaseEntity & {
  title: string;
  type: string;
  amount: number;
  date: ISODate;
  caseId?: string;
  /** İcra dosyasına ait masraf */
  enforcementId?: string;
  clientId?: string;
  /** Müvekkil: müvekkile yansıtılır (carisine borç yazılır). Büro: büro gideri. */
  chargeTo: "Müvekkil" | "Büro";
  /** Parayı kim ödedi. Müvekkil kendi ödediyse büro kasasından çıkış olmaz. */
  paidBy: "Büro" | "Müvekkil";
  accountId?: string;
  receipts: AttachmentRef[];
  note?: string;
  createdBy: string;
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
];
/** "Aylık ücret" otomatik aylık tahakkukta kullanılır: silinemez */
export const LOCKED_FEE_KINDS = ["Aylık ücret"];
export type FeeKind = string;

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
  category: "Virman" | "Diğer gelir" | "Diğer gider" | "Müvekkile aktarım" | "Kapanan dosya";
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
];
/** Varsayılan, otomatik "tahsil edildi" ve kapanış durumları: silinemez */
export const LOCKED_ENFORCEMENT_STATUSES = ["Derdest", "Tahsil edildi", "Kapandı"];
export type EnforcementStatus = string;

export const ENFORCEMENT_TYPES = ["İlamsız", "İlamlı", "Kambiyo", "Rehin", "Kira", "Diğer"];

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
  /** Borçluya tanımlanan taksit planına aitse plan kimliği */
  planId?: string;
  /** Taksit planındaki sıra (1'den başlar) */
  installmentNo?: number;
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

export const CONTACT_CHANNELS = ["Telefon", "WhatsApp", "Yüz yüze", "E-posta", "Tebligat"];

export type ContactLog = BaseEntity & {
  debtorId: string;
  enforcementId?: string;
  date: ISODate;
  channel: string;
  note: string;
  userId: string;
};

/* ───────────────────────── Belgeler ───────────────────────── */

export type DocumentFile = BaseEntity & {
  name: string;
  category: string;
  attachment: AttachmentRef;
  caseId?: string;
  clientId?: string;
  enforcementId?: string;
  uploadedBy: string;
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
  caseStatuses: string[];
  enforcementStatuses: string[];
  enforcementTypes: string[];
  paymentMethods: string[];
  feeKinds: string[];
  contactChannels: string[];
  /** Avukat rolünün varsayılan izinleri ("modül.eylem": açık/kapalı); Admin'in her şeye hakkı vardır */
  rolePermissions: Record<string, boolean>;
  /** Seçilebilir mahkemeler (yeni yazılan mahkeme otomatik eklenir) */
  courts: string[];
  /** Seçilebilir icra daireleri */
  enforcementOffices: string[];
};

export type Collections = {
  users: User;
  clients: Client;
  cases: CaseFile;
  expenses: Expense;
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
  notifications: AppNotification;
  activities: ActivityLog;
};

export type CollectionKey = keyof Collections;

/** Silinen kayıtlardan geriye kalan yıllık para toplamları */
export type YearStats = {
  /** Müvekkillerden tahsil edilen ücret */
  feeIncome: number;
  /** Borçlulardan tahsil edilen (icra) */
  icraCollected: number;
  officeExpense: number;
  clientExpense: number;
  otherIncome: number;
  otherExpense: number;
  closedCases: number;
};

export type ArchiveData = {
  years: Record<string, YearStats>;
  /** En son arşivlenen yıl (bu yıl ve öncesinin ayrıntıları silindi) */
  archivedThrough?: number;
};

export type ErpState = {
  version: number;
  firmId: string;
  settings: Settings;
  archive: ArchiveData;
} & {
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

export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: "Görüntüle",
  create: "Ekle",
  edit: "Düzenle",
  delete: "Sil",
};

export type PermissionModuleKey =
  | "clients"
  | "cases"
  | "documents"
  | "expenses"
  | "reminders"
  | "enforcements"
  | "fees"
  | "ledger"
  | "accounts"
  | "reports"
  | "activity";

export type PermissionModule = {
  key: PermissionModuleKey;
  label: string;
  hint: string;
  /** Bu modülde anlamlı olan eylemler */
  actions: PermissionAction[];
  /** Eylemin bu modüldeki özel açıklaması */
  actionHints?: Partial<Record<PermissionAction, string>>;
  /** true: Ekle / Düzenle / Sil açılınca Görüntüle de açılır, Görüntüle kapanınca hepsi kapanır */
  coupled: boolean;
  /** Yan menüde bu modüle ait sayfa */
  menu?: string;
};

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: "clients",
    label: "Müvekkiller",
    hint: "Müvekkil kartları ve sayfaları",
    actions: ["view", "create", "edit", "delete"],
    coupled: true,
    menu: "Müvekkiller",
  },
  {
    key: "cases",
    label: "Dosyalar",
    hint: "Dava ve danışmanlık dosyaları",
    actions: ["view", "create", "edit", "delete"],
    actionHints: { delete: "Dosyayı kapatır ve siler" },
    coupled: true,
    menu: "Dosyalar",
  },
  {
    key: "documents",
    label: "Belgeler",
    hint: "Yüklenen belgeler",
    actions: ["view", "create", "edit", "delete"],
    coupled: true,
    menu: "Belgeler",
  },
  {
    key: "expenses",
    label: "Masraflar",
    hint: "Kendi girdiği masrafı her zaman görür, düzenler ve siler",
    actions: ["view", "create", "edit", "delete"],
    actionHints: {
      view: "Başkalarının girdiği masrafları da görür",
      edit: "Başkalarının masrafını da düzenler",
      delete: "Başkalarının masrafını da siler",
    },
    coupled: false,
    menu: "Masraflar",
  },
  {
    key: "reminders",
    label: "Ajanda",
    hint: "Kendine atanan işleri her zaman görür",
    actions: ["view", "create", "edit", "delete"],
    actionHints: { view: "Tüm büronun ajandasını görür" },
    coupled: false,
  },
  {
    key: "enforcements",
    label: "İcra ve borçlular",
    hint: "İcra dosyaları, borçlular, taksit tanımlama, tahsilat girme",
    actions: ["view", "create", "edit", "delete"],
    coupled: true,
    menu: "İcra dosyaları, Borçlular",
  },
  {
    key: "fees",
    label: "Tahsilatlar",
    hint: "Ücret planları ve taksitler",
    actions: ["view", "create", "edit", "delete"],
    actionHints: {
      create: "Yeni tahsilat planı",
      edit: "Tahsilat alma, geri alma, plan düzenleme",
      delete: "Planı silme",
    },
    coupled: true,
    menu: "Tahsilatlar",
  },
  {
    key: "ledger",
    label: "Cari hesap",
    hint: "Müvekkil bakiyeleri ve ekstre",
    actions: ["view"],
    coupled: true,
    menu: "Cari hesap",
  },
  {
    key: "accounts",
    label: "Banka ve kasa",
    hint: "Hesap bakiyeleri, virman, hareketler",
    actions: ["view", "create", "edit", "delete"],
    coupled: true,
    menu: "Banka & Kasa",
  },
  {
    key: "reports",
    label: "Raporlar",
    hint: "Gelir-gider ve yıllık özet",
    actions: ["view"],
    coupled: true,
    menu: "Raporlar",
  },
  {
    key: "activity",
    label: "Aktivite geçmişi",
    hint: "Kimin neyi değiştirdiği",
    actions: ["view"],
    coupled: true,
    menu: "Aktivite geçmişi",
  },
];

export type PermissionKey = `${PermissionModuleKey}.${PermissionAction}`;

/** Avukat rolünün ilk (varsayılan) izinleri */
export const DEFAULT_LAWYER_PERMISSIONS: Record<string, boolean> = {
  "clients.view": true,
  "clients.create": true,
  "clients.edit": true,
  "cases.view": true,
  "cases.create": true,
  "cases.edit": true,
  "documents.view": true,
  "documents.create": true,
  "documents.edit": true,
  "documents.delete": true,
  "expenses.create": true,
  "reminders.create": true,
  "reminders.edit": true,
  "reminders.delete": true,
  "enforcements.view": true,
  "enforcements.create": true,
  "enforcements.edit": true,
};

export function permissionKey(module: PermissionModuleKey, action: PermissionAction) {
  return `${module}.${action}`;
}

/** Bir kişi için etkin izin: kişisel istisna > rol varsayılanı > kapalı (Admin her şeye sahip) */
export function permissionsFor(
  role: UserRole,
  roleGrants: Record<string, boolean> = DEFAULT_LAWYER_PERMISSIONS,
  userGrants: Record<string, boolean> = {},
) {
  const admin = role === "Admin";
  const can = (module: PermissionModuleKey, action: PermissionAction = "view") => {
    if (admin) return true;
    const key = permissionKey(module, action);
    return userGrants[key] ?? roleGrants[key] ?? false;
  };
  return {
    isAdmin: admin,
    isStaff: admin || role === "Avukat",
    /** Kullanıcı yönetimi, ayarlar, yedek ve arşiv yalnızca Admin'dedir */
    manageUsers: admin,
    manageSettings: admin,
    can,
  };
}

export type Permissions = ReturnType<typeof permissionsFor>;
